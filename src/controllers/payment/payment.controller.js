const mongoose = require("mongoose");
const basketModel = require("../../models/basket.model");
const productModel = require("../../models/product.model");
const orderModel = require("../../models/order.model");
const controller = require("../.controller");
const { ZarinPal } = require("zarinpal-node-sdk");

class paymentController extends controller {
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

  async authPayment(req, res, next) {
    try {
      
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new paymentController();
