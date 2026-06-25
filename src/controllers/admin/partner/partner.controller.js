const basketModel = require("../../../models/basket.model");
const expenseModel = require("../../../models/expense.model");
const settlementModel = require("../../../models/settlement.model");
const controller = require("../../.controller");

const TAX_RATE = 0.1;

// نام نمایشی شرکا (در صورت نیاز این‌جا تغییر بده)
const PARTNERS = {
  partner1: "علی",
  partner2: "محمد",
};

class partnerController extends controller {
  // سود هر واحد بر اساس درصد سود تکیِ همان محصول:
  // profit = price * p / (100 + p)
  unitProfit(price, percent) {
    const p = Number(percent) || 0;
    if (p <= 0) return 0;
    return (Number(price) || 0) * (p / (100 + p));
  }

  async partners(req, res, next) {
    try {
      // همه‌ی سفارش‌های پرداخت‌شده
      const orders = await basketModel
        .find({ status: "paid" })
        .populate("items.product", "title image darsad priceSingle");

      // تجمیع به تفکیک محصول
      const byProduct = new Map();
      let totalSales = 0;
      let grossProfit = 0;
      let totalTax = 0;
      let totalDiscount = 0;

      orders.forEach((order) => {
        totalDiscount += order.discountAmount || 0;
        totalTax += order.taxPrice || 0;

        (order.items || []).forEach((it) => {
          if (!it.product) return;
          const percent = it.product.darsad ? it.product.darsad.single : 0;
          const sale = (it.price || 0) * it.quantity;
          const profit = Math.round(this.unitProfit(it.price, percent)) * it.quantity;

          totalSales += sale;
          grossProfit += profit;

          const key = it.product._id.toString();
          const row = byProduct.get(key) || {
            productId: key,
            title: it.product.title,
            image: it.product.image,
            percent: percent || 0,
            quantity: 0,
            sale: 0,
            profit: 0,
          };
          row.quantity += it.quantity;
          row.sale += sale;
          row.profit += profit;
          byProduct.set(key, row);
        });
      });

      const productRows = Array.from(byProduct.values()).sort(
        (a, b) => b.profit - a.profit,
      );
      // مالیات هر محصول (اطلاعاتی)
      productRows.forEach((r) => (r.tax = Math.round(r.sale * TAX_RATE)));

      // هزینه‌های اضافه
      const expenses = await expenseModel.find().sort({ createdAt: -1 });
      const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

      // قیمت تمام‌شده‌ی کل محصولات (سرمایه) = کل فروش − سود ناخالص
      const costOfGoods = totalSales - grossProfit;

      // سود خالص = سود ناخالص − تخفیف‌ها − هزینه‌های اضافه
      const netProfit = grossProfit - totalDiscount - totalExpenses;
      // سهم سودِ هر شریک = نصف سود خالص
      const profitShare = Math.round(netProfit / 2);

      // کل مبلغی که باید به هر شریک پرداخت شود:
      //   شریک ۱ = مبلغ کل محصول (سرمایه) + سهم سود
      //   شریک ۲ = مالیات + سهم سود
      const due = {
        partner1: costOfGoods + profitShare,
        partner2: totalTax + profitShare,
      };

      // تسویه‌های ثبت‌شده
      const settlements = await settlementModel.find().sort({ createdAt: -1 });
      const paid = { partner1: 0, partner2: 0 };
      settlements.forEach((s) => {
        if (paid[s.partner] !== undefined) paid[s.partner] += s.amount || 0;
      });

      // باقی‌مانده = کل قابل پرداخت − پرداخت‌شده (با هر تسویه تغییر می‌کند)
      const remaining = {
        partner1: due.partner1 - paid.partner1,
        partner2: due.partner2 - paid.partner2,
      };

      return res.render("admin/partner/index", {
        partners: PARTNERS,
        productRows,
        totals: {
          totalSales,
          grossProfit,
          totalDiscount,
          totalExpenses,
          netProfit,
          totalTax,
        },
        costOfGoods,
        profitShare,
        due,
        expenses,
        settlements,
        paid,
        remaining,
        ordersCount: orders.length,
      });
    } catch (err) {
      next(err);
    }
  }

  // صفحه‌ی اختصاصی هر شریک: دفترحساب (کیف) با ریز هر مبلغ، تاریخ، دلیل و محصول
  async partnerDetail(req, res, next) {
    try {
      const map = {
        partner1: "partner1",
        partner2: "partner2",
        ali: "partner1",
        mohammad: "partner2",
      };
      const pk = map[req.params.partner];
      if (!pk) return next();

      const orders = await basketModel
        .find({ status: "paid" })
        .populate("items.product", "title image darsad");
      const expenses = await expenseModel.find().sort({ createdAt: 1 });
      const settlements = await settlementModel
        .find({ partner: pk })
        .sort({ createdAt: 1 });

      const entries = [];

      orders.forEach((order) => {
        const items = (order.items || []).filter((it) => it.product);
        const orderItemsPrice = items.reduce(
          (s, it) => s + (it.price || 0) * it.quantity,
          0,
        );

        items.forEach((it) => {
          const percent = it.product.darsad ? it.product.darsad.single : 0;
          const sale = (it.price || 0) * it.quantity;
          const profit = Math.round(this.unitProfit(it.price, percent)) * it.quantity;
          const profitHalf = Math.round(profit / 2);

          if (pk === "partner1") {
            // علی: قیمت تمام‌شده‌ی محصول + نصف سود
            entries.push({
              date: order.paidAt,
              sign: 1,
              amount: sale - profit,
              reason: "قیمت محصول",
              product: it.product.title,
              order: order.orderNumber,
            });
            entries.push({
              date: order.paidAt,
              sign: 1,
              amount: profitHalf,
              reason: "سهم سود",
              product: it.product.title,
              order: order.orderNumber,
            });
          } else {
            // محمد: مالیات + نصف سود
            const taxItem =
              orderItemsPrice > 0
                ? Math.round(((order.taxPrice || 0) * sale) / orderItemsPrice)
                : 0;
            entries.push({
              date: order.paidAt,
              sign: 1,
              amount: taxItem,
              reason: "مالیات",
              product: it.product.title,
              order: order.orderNumber,
            });
            entries.push({
              date: order.paidAt,
              sign: 1,
              amount: profitHalf,
              reason: "سهم سود",
              product: it.product.title,
              order: order.orderNumber,
            });
          }
        });

        // سهم تخفیف سفارش از سود کسر می‌شود (نصف برای هر شریک)
        if (order.discountAmount) {
          entries.push({
            date: order.paidAt,
            sign: -1,
            amount: Math.round(order.discountAmount / 2),
            reason: "سهم تخفیف سفارش",
            product: "—",
            order: order.orderNumber,
          });
        }
      });

      // سهم هزینه‌های اضافه (نصف برای هر شریک)
      expenses.forEach((e) => {
        entries.push({
          date: e.createdAt,
          sign: -1,
          amount: Math.round((e.amount || 0) / 2),
          reason: "سهم هزینه: " + e.title,
          product: "—",
        });
      });

      // تسویه‌ها = برداشت از کیف شریک
      settlements.forEach((s) => {
        entries.push({
          date: s.createdAt,
          sign: -1,
          amount: s.amount || 0,
          reason: "تسویه / پرداخت" + (s.note ? " — " + s.note : ""),
          product: "—",
          settlement: true,
        });
      });

      // مرتب‌سازی زمانی + محاسبه‌ی مانده‌ی در حال اجرا
      entries.sort((a, b) => new Date(a.date) - new Date(b.date));
      let running = 0;
      entries.forEach((en) => {
        running += en.sign * en.amount;
        en.balance = running;
      });

      const totalCredit = entries
        .filter((e) => e.sign > 0)
        .reduce((s, e) => s + e.amount, 0);
      const totalReducers = entries
        .filter((e) => e.sign < 0 && !e.settlement)
        .reduce((s, e) => s + e.amount, 0);
      const totalSettled = entries
        .filter((e) => e.settlement)
        .reduce((s, e) => s + e.amount, 0);
      const balance = totalCredit - totalReducers - totalSettled;

      entries.reverse(); // جدیدترین بالا

      return res.render("admin/partner/detail", {
        partners: PARTNERS,
        pk,
        partnerName: PARTNERS[pk],
        entries,
        totalCredit,
        totalReducers,
        totalSettled,
        balance,
      });
    } catch (err) {
      next(err);
    }
  }

  async addExpense(req, res, next) {
    try {
      const { title, amount, note } = req.body;
      const value = Number(amount);

      if (!title || !Number.isFinite(value) || value <= 0)
        return this.alertAndBack(req, res, {
          title: "عنوان و مبلغ معتبر هزینه را وارد کنید",
          icon: "error",
        });

      await expenseModel.create({
        title,
        amount: value,
        note,
        createdBy: req.user ? req.user._id : null,
      });

      return this.alertAndBack(req, res, {
        title: "هزینه ثبت شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteExpense(req, res, next) {
    try {
      await expenseModel.findByIdAndDelete(req.params.id);
      return this.alertAndBack(req, res, {
        title: "هزینه حذف شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  async addSettlement(req, res, next) {
    try {
      const { partner, amount, note } = req.body;
      const value = Number(amount);

      if (!["partner1", "partner2"].includes(partner))
        return this.alertAndBack(req, res, {
          title: "شریک نامعتبر است",
          icon: "error",
        });
      if (!Number.isFinite(value) || value <= 0)
        return this.alertAndBack(req, res, {
          title: "مبلغ تسویه معتبر نیست",
          icon: "error",
        });

      await settlementModel.create({
        partner,
        amount: value,
        note,
        createdBy: req.user ? req.user._id : null,
      });

      return this.alertAndBack(req, res, {
        title: "تسویه ثبت شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new partnerController();
