const mongoose = require("mongoose");
const basketModel = require("../../models/basket.model");
const productModel = require("../../models/product.model");
const addressModel = require("../../models/address.model");
const discountModel = require("../../models/discount.model");
const paymentService = require("../../services/payment.service");
const controller = require("../.controller");

// نرخ مالیات بر ارزش افزوده (۱۰٪)
const TAX_RATE = 0.1;

class paymentController extends controller {
  // ساخت سبد فعالِ جدید با خودترمیمی:
  // اگر ایندکس قدیمیِ unique روی user باعث خطای duplicate شد،
  // همان‌جا (در کنترلر) آن را حذف و دوباره تلاش می‌کنیم.
  async createActiveBasket(userId) {
    try {
      return await basketModel.create({
        user: userId,
        status: "active",
        items: [],
      });
    } catch (e) {
      if (e && e.code === 11000) {
        try {
          await basketModel.collection.dropIndex("user_1");
        } catch (_) {}
        return await basketModel.create({
          user: userId,
          status: "active",
          items: [],
        });
      }
      throw e;
    }
  }

  // محاسبه‌ی مبالغ سبدِ فعال به‌صورت سمت سرور (مرجع حقیقت)
  // قیمت‌ها هیچ‌وقت از کلاینت گرفته نمی‌شوند.
  async calcBasketTotals(userId, discountCodeRaw) {
    const basket = await basketModel
      .findOne({ user: userId, status: "active" })
      .populate("items.product", "title image priceSingle quantity isActive");

    const items =
      basket && basket.items
        ? basket.items.filter((it) => it.product && it.product.isActive)
        : [];

    let itemsPrice = 0;
    items.forEach((it) => {
      itemsPrice += (it.product.priceSingle || 0) * it.quantity;
    });

    // ───── اعمال کد تخفیف (در صورت وجود) ─────
    let discountAmount = 0;
    let discountDoc = null;
    let discountMessage = null;
    const code = (discountCodeRaw || "").toString().trim().toUpperCase();

    if (code && items.length) {
      discountDoc = await discountModel.findOne({ code });

      if (!discountDoc) {
        discountMessage = "کد تخفیف یافت نشد";
      } else {
        const validity = discountDoc.isValid(userId);
        if (!validity.valid) {
          discountMessage = validity.message;
          discountDoc = null;
        } else if (
          discountDoc.minPurchaseAmount &&
          itemsPrice < discountDoc.minPurchaseAmount
        ) {
          discountMessage = `حداقل مبلغ خرید برای این کد ${Number(
            discountDoc.minPurchaseAmount,
          ).toLocaleString("fa-IR")} تومان است`;
          discountDoc = null;
        } else {
          discountAmount = discountDoc.calculateDiscount(itemsPrice);
          discountMessage = "کد تخفیف اعمال شد";
        }
      }
    }

    // مالیات روی مبلغ پس از کسر تخفیف محاسبه می‌شود
    const taxableAmount = Math.max(itemsPrice - discountAmount, 0);
    const taxPrice = Math.round(taxableAmount * TAX_RATE);
    const finalPrice = Math.max(itemsPrice - discountAmount + taxPrice, 0);

    return {
      basket,
      items,
      itemsPrice,
      discountAmount,
      discountDoc,
      discountMessage,
      taxPrice,
      finalPrice,
    };
  }

  // اعتبارسنجی زنده‌ی کد تخفیف (برای فرم سبد خرید) — پاسخ JSON
  async validateDiscount(req, res, next) {
    try {
      const userId = req.user._id;
      const { discountCode } = req.body;

      const totals = await this.calcBasketTotals(userId, discountCode);

      if (totals.items.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "سبد خرید خالی است" });
      }

      const applied = totals.discountAmount > 0;

      return res.json({
        success: applied,
        message:
          totals.discountMessage ||
          (applied ? "کد تخفیف اعمال شد" : "کد تخفیف نامعتبر است"),
        itemsPrice: totals.itemsPrice,
        discountAmount: totals.discountAmount,
        taxPrice: totals.taxPrice,
        finalPrice: totals.finalPrice,
      });
    } catch (err) {
      next(err);
    }
  }

  async createPayment(req, res, next) {
    try {
      const userId = req.user._id;
      const { gateway, addressId, discountCode } = req.body;

      // ───── درگاه ─────
      const validGateways = ["zarinpal", "digipay"];
      if (!validGateways.includes(gateway)) {
        return res
          .status(400)
          .json({ success: false, message: "درگاه پرداخت نامعتبر است" });
      }

      // ───── آدرس ─────
      if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
        return res
          .status(400)
          .json({ success: false, message: "آدرس ارسال را انتخاب کنید" });
      }

      const address = await addressModel.findOne({
        _id: addressId,
        user: userId,
      });
      if (!address) {
        return res
          .status(404)
          .json({ success: false, message: "آدرس انتخاب‌شده یافت نشد" });
      }

      // ───── محاسبه‌ی مبالغ روی سبدِ فعال (سمت سرور) ─────
      const totals = await this.calcBasketTotals(userId, discountCode);

      if (totals.items.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "سبد خرید خالی است" });
      }

      const basket = totals.basket;

      // قیمت لحظه‌ی پرداخت را روی آیتم‌های سبد ثبت می‌کنیم (snapshot)
      basket.items.forEach((it) => {
        const p = totals.items.find(
          (vi) => vi.product._id.toString() === it.product._id.toString(),
        );
        if (p) it.price = p.product.priceSingle || it.price;
      });

      // ───── ذخیره‌ی اطلاعات سفارش روی همین سبدِ فعال ─────
      basket.shippingAddress = address._id;
      basket.shippingDetails = {
        receiver: address.receiver,
        phone: address.phone,
        address: address.address,
        postalCode: address.postalCode,
      };
      basket.paymentMethod = gateway;
      basket.paymentMethodLabel =
        gateway === "digipay" ? "دیجی‌پی (۴ قسط)" : "درگاه زرین‌پال";
      basket.totalPrice = totals.itemsPrice; // مجموع اقلام
      basket.taxPrice = totals.taxPrice;
      basket.discountCode = totals.discountDoc ? totals.discountDoc._id : null;
      basket.discountCodeString = totals.discountDoc
        ? totals.discountDoc.code
        : null;
      basket.discountAmount = totals.discountAmount;
      basket.finalPrice = totals.finalPrice;
      if (!basket.orderNumber) {
        basket.orderNumber = await basketModel.generateOrderNumber();
      }
      await basket.save();

      // ───────── اتصال به درگاه پرداخت ─────────
      // اگر کلید درگاه در .env تنظیم شده باشد، درخواست واقعی زده می‌شود؛
      // در غیر این صورت برای توسعه به verify آزمایشی (mock) هدایت می‌شویم.
      const base = `${req.protocol}://${req.get("host")}`;
      const callbackUrl = `${base}/payment/verify/${gateway}?basketId=${basket._id}`;
      let paymentUrl;

      try {
        if (!paymentService.isConfigured(gateway)) {
          paymentUrl = `/payment/verify/${gateway}?basketId=${basket._id}&mock=1`;
        } else if (gateway === "zarinpal") {
          const result = await paymentService.zarinpalRequest({
            amount: basket.finalPrice,
            callbackUrl,
            description: `پرداخت سفارش ${basket.orderNumber}`,
            mobile: req.user.phone,
            email: req.user.email || undefined,
          });
          basket.transactionId = result.authority;
          await basket.save();
          paymentUrl = result.url;
        } else {
          const result = await paymentService.digipayRequest({
            amount: basket.finalPrice,
            callbackUrl,
            cellNumber: req.user.phone,
            providerId: basket.orderNumber,
          });
          basket.transactionId = result.ticket;
          await basket.save();
          paymentUrl = result.url;
        }
      } catch (gwErr) {
        return res.status(502).json({
          success: false,
          message: gwErr.message || "خطا در اتصال به درگاه پرداخت",
        });
      }

      return res.json({
        success: true,
        paymentUrl,
        orderId: basket._id,
        amount: basket.finalPrice,
      });
    } catch (err) {
      next(err);
    }
  }

  // بازگشت از درگاه — تأیید پرداخت، کسر موجودی، paid کردن سبد و ساخت سبد فعال جدید
  async verifyPayment(req, res, next) {
    try {
      const { gateway } = req.params;
      const basketId = req.query.basketId || req.query.orderId;

      if (!basketId || !mongoose.Types.ObjectId.isValid(basketId)) {
        return res.render("shop/payment-result", {
          success: false,
          order: null,
          message: "شناسه سفارش نامعتبر است",
        });
      }

      const basket = await basketModel.findById(basketId);
      if (!basket) {
        return res.render("shop/payment-result", {
          success: false,
          order: null,
          message: "سفارش یافت نشد",
        });
      }

      // اگر قبلاً پرداخت شده، همان نتیجه را نشان بده (idempotent)
      if (basket.isPaid) {
        return res.render("shop/payment-result", {
          success: true,
          order: basket,
        });
      }

      // ───────── تأیید پرداخت با درگاه ─────────
      let verified = false;
      let refId = basket.transactionId;

      if (req.query.mock === "1") {
        verified = true; // حالت توسعه (بدون کلید درگاه)
      } else if (gateway === "zarinpal") {
        if (req.query.Status === "OK") {
          const result = await paymentService.zarinpalVerify({
            amount: basket.finalPrice,
            authority: req.query.Authority || basket.transactionId,
          });
          verified = result.ok;
          refId = result.refId || refId;
        }
      } else if (gateway === "digipay") {
        const trackingCode = req.query.trackingCode || basket.transactionId;
        const result = await paymentService.digipayVerify({ trackingCode });
        verified = result.ok;
        refId = result.refId || refId;
      }

      if (verified) {
        // کسر موجودی محصولات و افزایش فروش
        for (const item of basket.items) {
          await productModel.findByIdAndUpdate(item.product, {
            $inc: { quantity: -item.quantity, soldCount: item.quantity },
          });
        }

        // ثبت استفاده از کد تخفیف
        if (basket.discountCode && basket.discountAmount > 0) {
          const discountDoc = await discountModel.findById(basket.discountCode);
          if (discountDoc) {
            await discountDoc.recordUsage(
              basket.user,
              basket._id,
              basket.discountAmount,
            );
          }
        }

        // این سبد پرداخت‌شده می‌شود و به‌عنوان سفارش باقی می‌ماند
        await basket.markPaid(refId);

        // یک سبد فعالِ خالی جدید برای کاربر ساخته می‌شود (با خودترمیمیِ ایندکس)
        await this.createActiveBasket(basket.user);

        return res.render("shop/payment-result", {
          success: true,
          order: basket,
        });
      }

      // پرداخت ناموفق — سبد همچنان فعال می‌ماند تا کاربر دوباره تلاش کند
      return res.render("shop/payment-result", {
        success: false,
        order: basket,
        message: "پرداخت ناموفق بود",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new paymentController();
