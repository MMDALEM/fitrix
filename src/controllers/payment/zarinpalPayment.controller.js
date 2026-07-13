const mongoose = require("mongoose");
const basketModel = require("../../models/basket.model");
const productModel = require("../../models/product.model");
const orderModel = require("../../models/order.model");
const controller = require("../.controller");
const { ZarinPal } = require("zarinpal-node-sdk");

const zarinpal = new ZarinPal({
  merchantId: "process.env.ZARINPAL_MERCHANT_ID",
  sandbox: true,
});

class zarinpalPaymentController extends controller {
  // ───────────────────────────────────────────────
  // PLACEHOLDER زرین‌پال
  // مستندات: https://docs.zarinpal.com
  // بعداً: درخواست PaymentRequest بزن، authority را در order ذخیره کن،
  // و startpay URL را برگردان.
  // ───────────────────────────────────────────────
  async requestZarinpal(req, res, next) {
    try {
      initiatePayment();
    } catch (err) {
      next(err);
    }

    // نام پارامتر	نوع	الزامی	توضیحات
    // amount	Integer	بله	مبلغ پرداختی به ریال. حداقل مقدار پرداخت 10000 ریال است.
    // description	String	بله	توضیحات مربوط به تراکنش مانند شماره سفارش یا نام محصول.
    // callback_url	String	بله	آدرس بازگشت پس از تکمیل یا عدم موفقیت پرداخت.
    // mobile	String	خیر	شماره موبایل کاربر. (اختیاری)
    // email	String	خیر	ایمیل کاربر. (اختیاری)
    // referrer_id	String	خیر	کد معرف. (اختیاری)
    // currency	String	خیر	واحد پولی تراکنش. مقدار پیش‌فرض IRR (ریال) و مقدار دیگر IRT (تومان) است.
    // cardPan	String	خیر	شماره کارت بانکی که کاربر با آن پرداخت می‌کند. (اختیاری)
    // wages	Array	خیر	آرایه‌ای شامل اطلاعات تسهیم سود. هر عنصر شامل iban (شبا)، amount (مبلغ) و description (توضیح) است.

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
    // console.log("ZARINPAL placeholder for order", order.orderNumber);
    // return `/payment/verify/zarinpal?orderId=${order._id}&mock=1`;
  }

  async verifyZarinpal(req, res, next) {
    try {
      // Example usage:
      const authority = "A000000000000000000000000000000000";
      const status = "OK";

      verifyPayment(authority, status);
    } catch (err) {
      next(err);
    }
  }

  async initiatePayment(price, phone, email) {
    try {
      const response = await zarinpal.payments.create({
        amount: price,
        callback_url: process.env.ZARINPAL_CALLBACK_URL,
        description: "Payment for order #1234",
        mobile: phone,
        email: email,
        referrer_id: "affiliate123",
      });

    } catch (error) {
      console.error(error);
    }
  }

  async verifyPayment(authority, status) {
    if (status === "OK") {
      const amount = await getAmountFromDatabase(authority); // Implement this function

      if (amount) {
        try {
          const response = await zarinpal.verifications.verify({
            amount: amount,
            authority: authority,
          });

          if (response.data.code === 100) {
            console.log("Payment Verified:");
            console.log("Reference ID:", response.data.ref_id);
            console.log("Card PAN:", response.data.card_pan);
            console.log("Fee:", response.data.fee);
          } else if (response.data.code === 101) {
            console.log("Payment already verified.");
          } else {
            console.log("Transaction failed with code:", response.data.code);
          }
        } catch (error) {
          console.error("Payment Verification Failed:", error);
        }
      } else {
        console.log("No Matching Transaction Found For This Authority Code.");
      }
    } else {
      console.log("Transaction was cancelled or failed.");
    }
  }
}

module.exports = new zarinpalPaymentController();
