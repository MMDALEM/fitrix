const express = require("express");
const router = express.Router();

const couponController = require("../../controllers/admin/coupon/coupon.controller");

// لایوت ادمین
router.use((req, res, next) => {
  res.locals.layout = "admin/master";
  next();
});

// صفحه‌ی مدیریت کدهای تخفیف
router.get("/", couponController.index);
// ساخت/ویرایش
router.post("/save", couponController.save);
// حذف
router.post("/:id/delete", couponController.remove);
// فعال/غیرفعال
router.post("/:id/toggle", couponController.toggle);

module.exports = router;
