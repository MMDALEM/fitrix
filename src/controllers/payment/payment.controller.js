const mongoose = require("mongoose");
const basketModel = require("../../models/basket.model");
const productModel = require("../../models/product.model");
const orderModel = require("../../models/order.model");
const controller = require("../.controller");

class paymentController extends controller {
  // ساخت پرداخت: سفارش را می‌سازد و کاربر را به درگاه می‌فرستد
  async createPayment(req, res, next) {
    try {
      const userId = req.user._id;
      const { gateway } = req.body; // 'zarinpal' یا 'digipay'

      const validGateways = ["zarinpal", "digipay"];
      if (!validGateways.includes(gateway)) {
        return res
          .status(400)
          .json({ success: false, message: "درگاه نامعتبر است" });
      }

      // سبد کاربر با محصولات
      const basket = await basketModel
        .findOne({ user: userId })
        .populate("items.product", "title image priceSingle quantity isActive");

      const items =
        basket && basket.items
          ? basket.items.filter((it) => it.product && it.product.isActive)
          : [];

      if (items.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "سبد خرید خالی است" });
      }

      // ساخت آیتم‌های سفارش با قیمت سرور (هیچ‌وقت از کلاینت)
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

      const shippingPrice = 0; // در صورت نیاز محاسبه کن
      const totalPrice = itemsPrice + shippingPrice;

      // برچسب روش پرداخت
      const methodLabel =
        gateway === "digipay" ? "دیجی‌پی (۴ قسط)" : "درگاه زرین‌پال";

      // ساخت سفارش در وضعیت «در انتظار پرداخت»
      const order = await orderModel.create({
        user: userId,
        items: orderItems,
        // ⚠️ shippingAddress الزامی است — اینجا باید آدرس کاربر را بگذاری
        // shippingAddress: req.user.defaultAddress یا از body
        itemsPrice,
        shippingPrice,
        totalPrice,
        paymentMethod: "online",
        paymentMethodLabel: methodLabel,
        status: "pending_payment",
        statusLabel: "در انتظار پرداخت",
      });

      // ───────────────────────────────────────────────
      // اتصال به درگاه — اینجا placeholder است.
      // بعداً کلید/مرچنت واقعی را جایگزین کن.
      // ───────────────────────────────────────────────
      let paymentUrl;

      if (gateway === "zarinpal") {
        paymentUrl = await this.requestZarinpal(order, req);
      } else {
        paymentUrl = await this.requestDigipay(order, req);
      }

      if (!paymentUrl) {
        return res
          .status(502)
          .json({ success: false, message: "خطا در اتصال به درگاه" });
      }

      return res.json({ success: true, paymentUrl, orderId: order._id });
    } catch (err) {
      next(err);
    }
  }

  // ───────────────────────────────────────────────
  // PLACEHOLDER زرین‌پال
  // مستندات: https://docs.zarinpal.com
  // بعداً: درخواست PaymentRequest بزن، authority را در order ذخیره کن،
  // و startpay URL را برگردان.
  // ───────────────────────────────────────────────
  async requestZarinpal(order, req) {
    // const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    // const callbackUrl = `${req.protocol}://${req.get("host")}/payment/verify/zarinpal`;
    // const response = await fetch("https://payment.zarinpal.com/pg/v4/payment/request.json", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     merchant_id: merchantId,
    //     amount: order.totalPrice,        // تومان یا ریال — طبق مستندات تنظیم کن
    //     callback_url: callbackUrl,
    //     description: `سفارش ${order.orderNumber}`,
    //   }),
    // });
    // const data = await response.json();
    // const authority = data?.data?.authority;
    // order.transactionId = authority;  // ذخیره برای verify
    // await order.save();
    // return `https://payment.zarinpal.com/pg/StartPay/${authority}`;

    // فعلاً placeholder:
    console.log("ZARINPAL placeholder for order", order.orderNumber);
    return `/payment/verify/zarinpal?orderId=${order._id}&mock=1`;
  }

  // ───────────────────────────────────────────────
  // PLACEHOLDER دیجی‌پی (۴ قسط)
  // مستندات: https://docs.mydigipay.com
  // بعداً: توکن بگیر، تیکت پرداخت بساز، و redirectUrl را برگردان.
  // ───────────────────────────────────────────────
  async requestDigipay(order, req) {
    // const token = await getDigipayToken();  // OAuth
    // const callbackUrl = `${req.protocol}://${req.get("host")}/payment/verify/digipay`;
    // const response = await fetch("https://api.mydigipay.com/digipay/api/businesses/ticket?type=11", {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     amount: order.totalPrice,
    //     cellNumber: req.user.phone,
    //     callbackUrl,
    //     providerId: order.orderNumber,
    //   }),
    // });
    // const data = await response.json();
    // order.transactionId = data?.ticket;
    // await order.save();
    // return data?.redirectUrl;

    // فعلاً placeholder:
    console.log("DIGIPAY placeholder for order", order.orderNumber);
    return `/payment/verify/digipay?orderId=${order._id}&mock=1`;
  }

  // ───────────────────────────────────────────────
  // بازگشت از درگاه (verify) — مشترک، بعداً منطق هر درگاه را جدا کن
  // ───────────────────────────────────────────────
  async verifyPayment(req, res, next) {
    try {
      const { gateway } = req.params;
      const { orderId } = req.query;

      const order = await orderModel.findById(orderId);
      if (!order) {
        return res.render("shop/payment-result", {
          success: false,
          message: "سفارش یافت نشد",
        });
      }

      // ───────────────────────────────────────────────
      // اینجا باید پرداخت را با درگاه verify کنی.
      // اگر موفق بود:
      // ───────────────────────────────────────────────
      // const verified = await verifyWithGateway(gateway, order);
      const verified = req.query.mock === "1"; // فعلاً mock

      if (verified) {
        await order.markAsPaid(order.transactionId);

        // کسر موجودی محصولات
        for (const item of order.items) {
          await productModel.findByIdAndUpdate(item.product, {
            $inc: { quantity: -item.quantity, soldCount: item.quantity },
          });
        }

        // خالی کردن سبد
        const basket = await basketModel.findOne({ user: order.user });
        if (basket) await basket.clear();

        return res.render("shop/payment-result", {
          success: true,
          order,
        });
      } else {
        order.status = "payment_failed";
        order.statusLabel = "پرداخت ناموفق";
        await order.save();
        return res.render("shop/payment-result", {
          success: false,
          order,
          message: "پرداخت ناموفق بود",
        });
      }
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new paymentController();
