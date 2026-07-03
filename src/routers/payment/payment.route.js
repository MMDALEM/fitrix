const express = require("express");
const router = express.Router();

// controllers & middlewares
const paymentController = require("../../controllers/payment/payment.controller");
const { checkBasketAccess } = require("../../middlewares/basket.middleware");

// اعتبارسنجی زنده‌ی کد تخفیف
router.post(
  "/payment/discount",
  checkBasketAccess,
  paymentController.validateDiscount,
);

// ساخت سفارش و رفتن به درگاه
router.post(
  "/payment/create",
  checkBasketAccess,
  paymentController.createPayment,
);

// بازگشت از درگاه (basketId در مسیر؛ نسخه‌ی query هم برای سازگاری می‌ماند)
router.get(
  "/payment/verify/:gateway/:basketId",
  paymentController.verifyPayment,
);
// router.get("/payment/verify/:gateway", paymentController.verifyPayment);

// نمایش نتیجه‌ی پرداخت روی URL تمیز
router.get("/payment/result/:id", paymentController.paymentResult);

module.exports = router;
