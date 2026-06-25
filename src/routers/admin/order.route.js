const express = require("express");
const router = express.Router();

const orderController = require("../../controllers/admin/order/order.controller");

// لایوت ادمین
router.use((req, res, next) => {
  res.locals.layout = "admin/master";
  next();
});

// لیست سفارش‌ها
router.get("/", orderController.orders);

// ثبت ارسال (تیک ارسال)
router.post("/:id/ship", orderController.ship);

// برچسب پستی قابل چاپ
router.get("/:id/label", orderController.label);

module.exports = router;
