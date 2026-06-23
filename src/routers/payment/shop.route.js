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

// بازگشت از درگاه
router.get("/payment/verify/:gateway", paymentController.verifyPayment);

module.exports = router;
