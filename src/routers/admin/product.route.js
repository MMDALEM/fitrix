const experss = require("express");
const router = experss.Router();

//controllers
const productController = require("../../controllers/admin/product/product.controller");
const upload_multer = require("../../utils/multer");

//product render
router.get("/", productController.products);

router.get("/create", productController.createPage);

router.post("/create", upload_multer.single("image"), productController.create);

router.get("/edit/:id", productController.editPage);

router.post("/edit/:id", upload_multer.single("image"), productController.edit);

router.get("/update-prices", productController.updateAllPrices);

module.exports = router;
