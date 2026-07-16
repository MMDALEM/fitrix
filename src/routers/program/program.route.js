const express = require("express");
const router = express.Router();
const programController = require("../../controllers/program/program.controller");

// همه‌ی مسیرها نیازمندِ ورودِ کاربر هستند (verifyUser در router اصلی)

// فرم برنامه‌ساز
router.get("/", programController.page);
// ساخت + تولیدِ فوریِ برنامه
router.post("/create", programController.create);
// فهرست برنامه‌های کاربر
router.get("/mine", programController.mine);
// تولیدِ دوباره در صورتِ شکست
router.post("/:id/regenerate", programController.regenerate);
// شروعِ پرداخت برای بازکردنِ کامل
router.post("/:id/pay", programController.pay);
// بازگشت از درگاه
router.get("/:id/verify/:gateway", programController.verify);
router.post("/:id/verify/:gateway", programController.verify);
// پرسش‌وپاسخ
router.post("/:id/ask", programController.ask);
// خروجیِ PDF (چاپ)
router.get("/:id/pdf", programController.pdf);
// نمایشِ برنامه
router.get("/:id", programController.view);

module.exports = router;
