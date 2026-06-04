const experss = require("express");
const router = experss.Router();

//controllers

const productController = require("../../controllers/admin/product/product.controller");

router.use((req, res, next) => {
  res.locals.layout = "admin/pdf";
  next();
});

//product render
router.get("/", productController.productPagePDF);

module.exports = router;
