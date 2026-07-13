const express = require("express");
const router = express.Router();

const partnerController = require("../../controllers/admin/partner/partner.controller");

// لایوت ادمین
router.use((req, res, next) => {
  res.locals.layout = "admin/master";
  next();
});

// داشبورد تسویه شرکا
router.get("/", partnerController.partners);

// هزینه‌های اضافه
router.post("/expense", partnerController.addExpense);
router.post("/expense/:id/settle", partnerController.settleExpense);
router.post("/expense/:id/delete", partnerController.deleteExpense);

// ثبت تسویه با شریک
router.post("/settlement", partnerController.addSettlement);

// صفحه‌ی اختصاصی هر شریک (دفترحساب/کیف) — باید بعد از روت‌های بالا باشد
router.get("/:partner", partnerController.partnerDetail);

module.exports = router;
