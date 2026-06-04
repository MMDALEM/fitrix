const experss = require("express");
const router = experss.Router();

//controllers
const basketController = require("../../controllers/shop/basket.controller");

// صفحه‌ی سبد
router.get("/", basketController.getBasket);

// تعداد اقلام سبد (برای عدد هدر)
router.get("/count", basketController.getBasketCount);

// افزودن به سبد
router.post("/add", basketController.addToBasket);

// تغییر تعداد
router.post("/update", basketController.updateBulk);

// حذف یک محصول
router.delete("/remove/:productId", basketController.removeFromBasket);

// خالی کردن سبد
router.delete("/clear", basketController.clearBasket);

module.exports = router;
