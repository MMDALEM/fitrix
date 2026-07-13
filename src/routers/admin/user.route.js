const express = require("express");
const router = express.Router();

const userController = require("../../controllers/admin/user/user.controller");

// لایوت ادمین
router.use((req, res, next) => {
  res.locals.layout = "admin/master";
  next();
});

// لیست کاربران (با جستجو و صفحه‌بندی)
router.get("/", userController.index);

// فعال/مسدود کردن کاربر
router.post("/:id/toggle-active", userController.toggleActive);

// تغییر نقش (فقط سوپرادمین)
router.post("/:id/role", userController.setRole);

// جزئیات کاربر — باید بعد از روت‌های بالا باشد
router.get("/:id", userController.detail);

module.exports = router;
