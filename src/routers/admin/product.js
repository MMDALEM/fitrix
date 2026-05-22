const experss = require("express");
const router = experss.Router();

//controllers
const productController = require("../../controllers/admin/product/product.controller");
const upload_multer = require("../../utils/multer");

//product render
router.get("/", productController.product);

router.get("/page", productController.productPagePDF);

router.post("/", upload_multer.single("image"), productController.create);

module.exports = router;
