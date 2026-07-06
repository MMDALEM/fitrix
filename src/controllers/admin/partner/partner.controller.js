const basketModel = require("../../../models/basket.model");
const expenseModel = require("../../../models/expense.model");
const settlementModel = require("../../../models/settlement.model");
const controller = require("../../.controller");

const TAX_RATE = 0.1;

// هزینه‌ی سایت: ۱۵٪ از مبلغ سودِ هر تک محصول
const SITE_COST_RATE = 0.15;

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

  // اقتصاد هر آیتم سفارش:
  //  - fullPrice = قیمت کامل (قبل از تخفیف محصول) — اگر روی آیتم ذخیره نشده بود
  //    (سفارش‌های قدیمی) همان قیمت فروش در نظر گرفته می‌شود
  //  - سود واقعی هر واحد = سود کاملِ قیمت بدون تخفیف − مبلغ تخفیف محصول
  //  - هزینه سایت هر واحد = ۱۵٪ از سود واقعی (اگر سود مثبت باشد)
  itemEconomics(it) {
    const percent = it.product && it.product.darsad ? it.product.darsad.single : 0;
    const price = it.price || 0;
    const fullPrice = it.fullPrice && it.fullPrice > 0 ? it.fullPrice : price;
    const qty = it.quantity || 0;

    const unitDiscount = Math.max(0, fullPrice - price);
    const unitProfitFull = Math.round(this.unitProfit(fullPrice, percent));
    const unitProfitActual = unitProfitFull - unitDiscount;
    const unitSiteCost =
      unitProfitActual > 0 ? Math.round(unitProfitActual * SITE_COST_RATE) : 0;

    return {
      percent: percent || 0,
      discountPercent: it.discountPercent || 0,
      qty,
      sale: price * qty,
      fullSale: fullPrice * qty,
      discount: unitDiscount * qty,
      profit: unitProfitActual * qty,
      siteCost: unitSiteCost * qty,
    };
  }

  async partners(req, res, next) {
    try {
      // همه‌ی سفارش‌های پرداخت‌شده
      const orders = await basketModel
        .find({ status: "paid" })
        .populate("items.product", "title image darsad priceSingle salePercent");

      // تجمیع به تفکیک محصول + تفکیک درصدهای تخفیف
      const byProduct = new Map();
      const byDiscountPercent = new Map();
      let totalSales = 0;
      let grossProfit = 0;
      let totalTax = 0;
      let totalDiscount = 0; // تخفیفِ کدهای تخفیف (سطح سفارش)
      let totalProductDiscount = 0; // تخفیف خود محصولات (سطح آیتم)
      let totalSiteCost = 0; // هزینه سایت = ۱۵٪ سود هر تک محصول

      orders.forEach((order) => {
        totalDiscount += order.discountAmount || 0;
        totalTax += order.taxPrice || 0;

        (order.items || []).forEach((it) => {
          if (!it.product) return;
          const eco = this.itemEconomics(it);

          totalSales += eco.sale;
          grossProfit += eco.profit;
          totalProductDiscount += eco.discount;
          totalSiteCost += eco.siteCost;

          const key = it.product._id.toString();
          const row = byProduct.get(key) || {
            productId: key,
            title: it.product.title,
            image: it.product.image,
            percent: eco.percent,
            discountPercent: eco.discountPercent,
            quantity: 0,
            sale: 0,
            discount: 0,
            profit: 0,
            siteCost: 0,
          };
          row.quantity += eco.qty;
          row.sale += eco.sale;
          row.discount += eco.discount;
          row.profit += eco.profit;
          row.siteCost += eco.siteCost;
          if (eco.discountPercent > row.discountPercent)
            row.discountPercent = eco.discountPercent;
          byProduct.set(key, row);

          // تفکیک بر اساس درصد تخفیف (۰٪ = بدون تخفیف)
          const dKey = eco.discountPercent;
          const dRow = byDiscountPercent.get(dKey) || {
            percent: dKey,
            products: new Set(),
            quantity: 0,
            sale: 0,
            discount: 0,
            profit: 0,
          };
          dRow.products.add(key);
          dRow.quantity += eco.qty;
          dRow.sale += eco.sale;
          dRow.discount += eco.discount;
          dRow.profit += eco.profit;
          byDiscountPercent.set(dKey, dRow);
        });
      });

      const productRows = Array.from(byProduct.values()).sort(
        (a, b) => b.profit - a.profit,
      );
      // مالیات هر محصول (اطلاعاتی)
      productRows.forEach((r) => (r.tax = Math.round(r.sale * TAX_RATE)));

      // ردیف‌های تفکیک درصد تخفیف (مرتب از تخفیف بیشتر به کمتر)
      const discountRows = Array.from(byDiscountPercent.values())
        .map((d) => ({
          percent: d.percent,
          productsCount: d.products.size,
          quantity: d.quantity,
          sale: d.sale,
          discount: d.discount,
          profit: d.profit,
        }))
        .sort((a, b) => b.percent - a.percent);

      // هزینه‌های اضافه
      const expenses = await expenseModel.find().sort({ createdAt: -1 });
      const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

      // قیمت تمام‌شده‌ی کل محصولات (سرمایه) = کل فروش − سود ناخالص
      // (سود ناخالص از قیمتِ واقعی فروش — بعد از تخفیف محصول — محاسبه شده)
      const costOfGoods = totalSales - grossProfit;

      // سود خالص = سود ناخالص − تخفیف کدها − هزینه‌های اضافه − هزینه سایت (۱۵٪)
      const netProfit =
        grossProfit - totalDiscount - totalExpenses - totalSiteCost;
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
        discountRows,
        siteCostRate: SITE_COST_RATE,
        totals: {
          totalSales,
          grossProfit,
          totalDiscount,
          totalProductDiscount,
          totalSiteCost,
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
          const eco = this.itemEconomics(it);
          const sale = eco.sale;
          const profit = eco.profit;
          const profitHalf = Math.round(profit / 2);
          // سهم هر شریک از هزینه سایت (۱۵٪ سود همین آیتم)
          const siteCostHalf = Math.round(eco.siteCost / 2);

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

          // هزینه سایت (۱۵٪ از سود هر تک محصول) — نصف از هر شریک کسر می‌شود
          if (siteCostHalf > 0) {
            entries.push({
              date: order.paidAt,
              sign: -1,
              amount: siteCostHalf,
              reason: "سهم هزینه سایت (۱۵٪ سود)",
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
