const mongoose = require("mongoose");
const basketModel = require("../../models/basket.model");
const productModel = require("../../models/product.model");
const orderModel = require("../../models/order.model");
const addressModel = require("../../models/address.model");
const discountModel = require("../../models/discount.model");
const paymentService = require("../../services/payment.service");
const controller = require("../.controller");

// نرخ مالیات بر ارزش افزوده (۱۰٪)
const TAX_RATE = 0.1;

class paymentController extends controller {
  // محاسبه‌ی مبالغ سبد به‌صورت سمت سرور (مرجع حقیقت)
  // قیمت‌ها هیچ‌وقت از کلاینت گرفته نمی‌شوند.
  async calcBasketTotals(userId, discountCodeRaw) {
    const basket = await basketModel
      .findOne({ user: userId })
      .populate("items.product", "title image priceSingle quantity isActive");

    const items =
      basket && basket.items
        ? basket.items.filter((it) => it.product && it.product.isActive)
        : [];

    let itemsPrice = 0;
    const orderItems = items.map((it) => {
      const unit = it.product.priceSingle || 0;
      const total = unit * it.quantity;
      itemsPrice += total;
      return {
        product: it.product._id,
        productName: it.product.title,
        quantity: it.quantity,
        price: unit,
        totalPrice: total,
        image: it.product.image,
      };
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
    const shippingPrice = 0; // در صورت نیاز محاسبه شود
    const finalPrice = Math.max(
      itemsPrice - discountAmount + taxPrice + shippingPrice,
      0,
    );

    return {
      basket,
      items,
      orderItems,
      itemsPrice,
      discountAmount,
      discountDoc,
      discountMessage,
      taxPrice,
      shippingPrice,
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

      // ───── محاسبه‌ی مبالغ (سمت سرور) ─────
      const totals = await this.calcBasketTotals(userId, discountCode);

      if (totals.items.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "سبد خرید خالی است" });
      }

      // برچسب روش پرداخت
      const methodLabel =
        gateway === "digipay" ? "دیجی‌پی (۴ قسط)" : "درگاه زرین‌پال";

      // ───── ساخت سفارش در وضعیت «در انتظار پرداخت» ─────
      const order = await orderModel.create({
        user: userId,
        items: totals.orderItems,
        shippingAddress: address._id,
        shippingDetails: {
          receiver: address.receiver,
          phone: address.phone,
          address: address.address,
          postalCode: address.postalCode,
          city: address.city,
          state: address.state,
        },
        itemsPrice: totals.itemsPrice,
        shippingPrice: totals.shippingPrice,
        taxPrice: totals.taxPrice,
        discountCode: totals.discountDoc ? totals.discountDoc._id : null,
        discountCodeString: totals.discountDoc ? totals.discountDoc.code : null,
        discountAmount: totals.discountAmount,
        totalPrice: totals.finalPrice, // در pre('save') دوباره بازمحاسبه می‌شود
        paymentMethod: "online",
        paymentMethodLabel: methodLabel,
        status: "pending_payment",
        statusLabel: "در انتظار پرداخت",
      });

      // ───────── اتصال به درگاه پرداخت ─────────
      // اگر کلید درگاه در .env تنظیم شده باشد، درخواست واقعی زده می‌شود؛
      // در غیر این صورت برای توسعه به verify آزمایشی (mock) هدایت می‌شویم.
      const base = `${req.protocol}://${req.get("host")}`;
      const callbackUrl = `${base}/payment/verify/${gateway}?orderId=${order._id}`;
      let paymentUrl;

      try {
        if (!paymentService.isConfigured(gateway)) {
          paymentUrl = `/payment/verify/${gateway}?orderId=${order._id}&mock=1`;
        } else if (gateway === "zarinpal") {
          const result = await paymentService.zarinpalRequest({
            amount: order.totalPrice,
            callbackUrl,
            description: `پرداخت سفارش ${order.orderNumber}`,
            mobile: req.user.phone,
            email: req.user.email || undefined,
          });
          order.transactionId = result.authority;
          await order.save();
          paymentUrl = result.url;
        } else {
          const result = await paymentService.digipayRequest({
            amount: order.totalPrice,
            callbackUrl,
            cellNumber: req.user.phone,
            providerId: order.orderNumber,
          });
          order.transactionId = result.ticket;
          await order.save();
          paymentUrl = result.url;
        }
      } catch (gwErr) {
        order.status = "payment_failed";
        order.statusLabel = "خطا در اتصال به درگاه";
        await order.save();
        return res.status(502).json({
          success: false,
          message: gwErr.message || "خطا در اتصال به درگاه پرداخت",
        });
      }

      return res.json({
        success: true,
        paymentUrl,
        orderId: order._id,
        amount: order.totalPrice,
      });
    } catch (err) {
      next(err);
    }
  }

  // بازگشت از درگاه — تأیید پرداخت، کسر موجودی و خالی‌کردن سبد
  async verifyPayment(req, res, next) {
    try {
      const { gateway } = req.params;
      const { orderId } = req.query;

      if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
        return res.render("shop/payment-result", {
          success: false,
          order: null,
          message: "شناسه سفارش نامعتبر است",
        });
      }

      const order = await orderModel.findById(orderId);
      if (!order) {
        return res.render("shop/payment-result", {
          success: false,
          order: null,
          message: "سفارش یافت نشد",
        });
      }

      // اگر قبلاً پرداخت شده، همان نتیجه را نشان بده
      if (order.isPaid) {
        return res.render("shop/payment-result", { success: true, order });
      }

      // ───────── تأیید پرداخت با درگاه ─────────
      let verified = false;
      let refId = order.transactionId;

      if (req.query.mock === "1") {
        verified = true; // حالت توسعه (بدون کلید درگاه)
      } else if (gateway === "zarinpal") {
        if (req.query.Status === "OK") {
          const result = await paymentService.zarinpalVerify({
            amount: order.totalPrice,
            authority: req.query.Authority || order.transactionId,
          });
          verified = result.ok;
          refId = result.refId || refId;
        }
      } else if (gateway === "digipay") {
        const trackingCode = req.query.trackingCode || order.transactionId;
        const result = await paymentService.digipayVerify({ trackingCode });
        verified = result.ok;
        refId = result.refId || refId;
      }

      if (verified) {
        await order.markAsPaid(refId);

        // کسر موجودی محصولات و افزایش فروش
        for (const item of order.items) {
          await productModel.findByIdAndUpdate(item.product, {
            $inc: { quantity: -item.quantity, soldCount: item.quantity },
          });
        }

        // ثبت استفاده از کد تخفیف
        if (order.discountCode && order.discountAmount > 0) {
          const discountDoc = await discountModel.findById(order.discountCode);
          if (discountDoc) {
            await discountDoc.recordUsage(
              order.user,
              order._id,
              order.discountAmount,
            );
          }
        }

        // خالی‌کردن سبد کاربر
        const basket = await basketModel.findOne({ user: order.user });
        if (basket) await basket.clear();

        return res.render("shop/payment-result", { success: true, order });
      }

      order.status = "payment_failed";
      order.statusLabel = "پرداخت ناموفق";
      await order.save();
      return res.render("shop/payment-result", {
        success: false,
        order,
        message: "پرداخت ناموفق بود",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new paymentController();
