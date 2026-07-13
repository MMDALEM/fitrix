const mongoose = require("mongoose");
const basketModel = require("../../models/basket.model");
const productModel = require("../../models/product.model");
const addressModel = require("../../models/address.model");
const discountModel = require("../../models/discount.model");
const settingModel = require("../../models/setting.model");
const notificationModel = require("../../models/notification.model");
const paymentService = require("../../services/payment.service");
const controller = require("../.controller");
const { manager, successpayment } = require("../../utils/sms");

const DEFAULT_TAX_RATE = 0.1;

class paymentController extends controller {
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

  async calcBasketTotals(userId, discountCodeRaw) {
    const basket = await basketModel
      .findOne({ user: userId, status: "active" })
      .populate(
        "items.product",
        "title image priceSingle salePrice salePercent onSale saleStartDate saleEndDate quantity isActive",
      );

    const items =
      basket && basket.items
        ? basket.items.filter((it) => it.product && it.product.isActive)
        : [];

    // قیمت مؤثر محصول: اگر تخفیف محصول همین حالا فعال باشد (بازه‌ی تاریخ) قیمت تخفیف‌خورده
    const effectivePrice = (p) =>
      p.saleIsActive() ? p.salePrice : p.priceSingle || 0;

    let itemsPrice = 0;
    items.forEach((it) => {
      itemsPrice += effectivePrice(it.product) * it.quantity;
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

    let taxRate = DEFAULT_TAX_RATE;
    try {
      const settings = await settingModel.getSingleton();
      taxRate = settings.taxEnabled
        ? (settings.taxRate ?? DEFAULT_TAX_RATE)
        : 0;
    } catch (_) {}

    const taxableAmount = Math.max(itemsPrice - discountAmount, 0);
    const taxPrice = Math.round(taxableAmount * taxRate);
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
      // + قیمت کامل و درصد تخفیف محصول برای گزارش حسابداری
      basket.items.forEach((it) => {
        const p = totals.items.find(
          (vi) => vi.product._id.toString() === it.product._id.toString(),
        );
        if (p) {
          const prod = p.product;
          const hasSale = prod.saleIsActive();
          it.price = (hasSale ? prod.salePrice : prod.priceSingle) || it.price;
          it.fullPrice = prod.priceSingle || it.price;
          it.discountPercent = hasSale ? prod.salePercent || 0 : 0;
        }
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
      // basketId را در مسیر می‌گذاریم تا در URL کوئریِ اضافه نماند
      const callbackUrl = `${base}/payment/verify/${gateway}/${basket._id}`;
      let paymentUrl;

      try {
        if (!paymentService.isConfigured(gateway)) {
          // در production پرداختِ آزمایشی (mock) مجاز نیست؛ اگر کلید درگاه
          // تنظیم نشده باشد، به‌جای صدور سفارشِ رایگان خطا برمی‌گردانیم
          if (process.env.NODE_ENV === "production") {
            return res.status(503).json({
              success: false,
              message:
                "درگاه پرداخت در حال حاضر در دسترس نیست. لطفاً بعداً تلاش کنید.",
            });
          }
          paymentUrl = `/payment/verify/${gateway}/${basket._id}?mock=1`;
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
          // providerId باید در هر تلاش یکتا باشد تا دیجی‌پی تیکت تازه بسازد
          // (در غیر این صورت تیکتِ منقضی‌شده‌ی قبلی برگردانده می‌شود). این مقدار
          // را ذخیره می‌کنیم چون دیجی‌پی هنگام verify هم به آن نیاز دارد.
          const providerId = `${basket.orderNumber}-${Date.now()}`;
          const result = await paymentService.digipayRequest({
            amount: basket.finalPrice,
            callbackUrl,
            cellNumber: req.user.phone,
            providerId,
          });
          basket.transactionId = result.ticket;
          basket.providerId = providerId;
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
      // بعضی درگاه‌ها نتیجه را با POST (در body) و بعضی با GET (در query)
      // برمی‌گردانند. در Express 5 خودِ req.query فقط‌خواندنی (getter) است و
      // نمی‌توان به آن مقدار داد؛ پس پارامترها را در یک شیء محلی ادغام می‌کنیم.
      const params = { ...(req.query || {}) };
      if (req.method === "POST" && req.body && typeof req.body === "object") {
        Object.assign(params, req.body);
      }


      // basketId از مسیر (path) خوانده می‌شود تا در URL تمیز بماند؛
      // برای سازگاری، query هم پشتیبانی می‌شود.
      const basketId = req.params.basketId || params.basketId || params.orderId;

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

      // اگر قبلاً پرداخت شده، مستقیم به صفحه‌ی نتیجه‌ی تمیز برو (idempotent)
      if (basket.isPaid) {
        return res.redirect("/payment/result/" + basket._id);
      }

      // ───────── تأیید پرداخت با درگاه ─────────
      let verified = false;
      let refId = basket.transactionId;
      let failReason = null; // دلیلِ ناموفق‌بودن (برای نمایش به کاربر)

      if (params.mock === "1" && process.env.NODE_ENV !== "production") {
        verified = true; // فقط در حالت توسعه (بدون کلید درگاه) — در production غیرفعال
      } else if (gateway === "zarinpal") {
        if (params.Status === "OK") {
          const result = await paymentService.zarinpalVerify({
            amount: basket.finalPrice,
            authority: params.Authority || basket.transactionId,
          });
          verified = result.ok;
          refId = result.refId || refId;
        }
      } else if (gateway === "digipay") {
        // دیجی‌پی همه‌ی اطلاعات لازم را در callback می‌فرستد: trackingCode،
        // providerId، نوعِ واقعیِ تراکنش (type) و نتیجه (result).
        // ‼️ verify باید با همین type و providerIdِ callback انجام شود، نه با
        //    مقادیرِ ثابتِ .env؛ چون کاربر ممکن است روی صفحه‌ی دیجی‌پی روشِ
        //    پرداخت را عوض کند (مثلاً کیف‌پول → اقساطی).
        const cbResult = String(params.result || "").toUpperCase();
        const cbType = params.type || undefined;
        const trackingCode =
          params.trackingCode ||
          params.trackingcode ||
          params.tracking_code ||
          "";
        const providerId = params.providerId || basket.providerId || undefined;

        if (cbResult && cbResult !== "SUCCESS") {
          // کاربر لغو کرد یا پرداخت ناموفق بود — اصلاً verify نمی‌کنیم
          verified = false;
          failReason =
            cbResult === "CANCEL"
              ? "پرداخت توسط شما لغو شد"
              : "پرداخت ناموفق بود";
        } else if (!trackingCode) {
          verified = false;
          failReason = "کد پیگیری از درگاه دریافت نشد";
        } else {
          const result = await paymentService.digipayVerify({
            trackingCode,
            providerId,
            type: cbType,
          });
          verified = result.ok;
          refId = result.refId || refId;
          if (!verified) failReason = result.message || null;

          // تیکت‌های قسطی/اعتباری (بر اساس نوعِ واقعیِ callback) بعد از verify
          // نیاز به مرحله‌ی deliver دارند. اما چون verifyِ موفق یعنی پرداخت
          // تأیید شده، خطای احتمالیِ deliver را «مسدودکننده» نمی‌کنیم تا سفارشِ
          // پرداخت‌شده از دست نرود؛ فقط لاگ می‌کنیم تا در صورت نیاز ادمین دستی
          // در پنل دیجی‌پی تحویل را ثبت کند.
          if (verified && paymentService.digipayNeedsDeliver(cbType)) {
            try {
              const del = await paymentService.digipayDeliver({
                trackingCode,
                type: cbType,
                invoiceNumber: basket.orderNumber,
                amount: basket.finalPrice,
                products: (basket.items || []).map((it) => String(it.product)),
              });
              if (!del.ok) {
                console.error(
                  "DigiPay deliver FAILED (سفارش پرداخت‌شده — نیاز به تحویلِ دستی):",
                  basket.orderNumber,
                  del.message,
                );
              }
            } catch (delErr) {
              console.error("DigiPay deliver error:", delErr.message);
            }
          }
        }
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

        // پیامک‌ها نباید در صورت خطای سرویسِ پیامک، نمایشِ نتیجه‌ی پرداختِ
        // موفق را بشکنند (سفارش قبلاً ثبت شده است)
        try {
          await successpayment(
            basket.shippingDetails?.phone + "",
            basket.orderNumber + "",
          );
          await manager("09167728327", basket.orderNumber + "");
          await manager("09373640517", basket.orderNumber + "");
        } catch (smsErr) {
          console.error("SMS notify failed:", smsErr.message);
        }

        // وضعیت دوستانه: در دست اقدام
        basket.statusLabel = "در دست اقدام";
        await basket.save();

        // اعلان‌ها: به ادمین‌ها (سفارش جدید) و به کاربر (تشکر از خرید)
        try {
          const amount = Number(
            basket.finalPrice || basket.totalPrice || 0,
          ).toLocaleString("fa-IR");
          const itemsCount = (basket.items || []).reduce(
            (s, it) => s + (it.quantity || 0),
            0,
          );
          await notificationModel.create([
            {
              audience: "admin",
              type: "order",
              title: `سفارش جدید ثبت شد — ${basket.orderNumber || ""}`,
              message: `مبلغ ${amount} تومان، ${itemsCount} کالا. لطفاً برای آماده‌سازی و ارسال اقدام کنید.`,
              order: basket._id,
              link: "/admin/orders",
            },
            {
              audience: "user",
              user: basket.user,
              type: "order",
              title: "از خرید شما سپاسگزاریم",
              message: `سفارش شما با شماره ${basket.orderNumber || ""} با موفقیت ثبت شد و هم‌اکنون در دست اقدام است. به‌زودی برای شما ارسال می‌شود.`,
              order: basket._id,
              link: "/dashboard",
            },
          ]);
        } catch (_) {}

        // یک سبد فعالِ خالی جدید برای کاربر ساخته می‌شود (با خودترمیمیِ ایندکس)
        await this.createActiveBasket(basket.user);

        // ریدایرکت به URL تمیز (بدون Authority/Status/basketId در کوئری)
        return res.redirect("/payment/result/" + basket._id);
      }

      // پرداخت ناموفق — سبد همچنان فعال می‌ماند تا کاربر دوباره تلاش کند
      if (req.flash)
        req.flash(
          "payMessage",
          failReason
            ? `پرداخت ناموفق بود: ${failReason}`
            : "پرداخت ناموفق بود",
        );
      return res.redirect("/payment/result/" + basket._id);
    } catch (err) {
      next(err);
    }
  }

  // نمایش نتیجه‌ی پرداخت روی یک URL تمیز: /payment/result/:id
  async paymentResult(req, res, next) {
    try {
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.render("shop/payment-result", {
          success: false,
          order: null,
          message: "تراکنش یافت نشد",
        });
      }

      const order = await basketModel.findById(id);
      if (!order) {
        return res.render("shop/payment-result", {
          success: false,
          order: null,
          message: "تراکنش یافت نشد",
        });
      }

      const success = !!order.isPaid;
      const flashArr = req.flash ? req.flash("payMessage") : [];
      const flashMsg = flashArr && flashArr.length ? flashArr[0] : null;

      return res.render("shop/payment-result", {
        success,
        order,
        message: success ? null : flashMsg || "پرداخت انجام نشد یا ناتمام ماند",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new paymentController();
