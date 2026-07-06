const experss = require("express");
const router = experss.Router();

//controllers
const productController = require("../../controllers/admin/product/product.controller");
const upload_multer = require("../../utils/multer");

//product render
router.get("/", productController.products);

// فروش شگفت‌انگیز — انتخاب محصولات اسلایدر صفحه اصلی
router.get("/amazing", productController.amazingPage);
router.post("/amazing/:id/toggle", productController.toggleAmazing);

router.get("/create", productController.createPage);

router.post("/create", upload_multer.single("image"), productController.create);

router.get("/edit/:id", productController.editPage);

router.post("/edit/:id", upload_multer.single("image"), productController.edit);



module.exports = router;
