const express = require("express");
const router = express.Router();

const discountController = require("../../controllers/admin/discount/discount.controller");

// لایوت ادمین
router.use((req, res, next) => {
  res.locals.layout = "admin/master";
  next();
});

// صفحه‌ی مدیریت تخفیف‌ها
router.get("/", discountController.index);

// ثبت/ویرایش تخفیف یک محصول (با بازه‌ی تاریخ)
router.post("/save", discountController.save);

// حذف تخفیف یک محصول
router.post("/:id/clear", discountController.clear);

module.exports = router;
