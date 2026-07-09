const mongoose = require("mongoose");
const basketModel = require("../../models/basket.model");
const productModel = require("../../models/product.model");
const orderModel = require("../../models/order.model");
const controller = require("../.controller");

class digipayPaymentController extends controller {
  // ───────────────────────────────────────────────
  // PLACEHOLDER دیجی‌پی (۴ قسط)
  // مستندات: https://docs.mydigipay.com
  // بعداً: توکن بگیر، تیکت پرداخت بساز، و redirectUrl را برگردان.
  // ───────────────────────────────────────────────
  async requestDigipay(req, res, next) {
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

module.exports = new digipayPaymentController();
