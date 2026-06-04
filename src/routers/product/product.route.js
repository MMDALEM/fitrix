const experss = require("express");
const router = experss.Router();

//controllers
const categoriesController = require("../../controllers/product/categories/categories.controller");
const productController = require("../../controllers/product/product.controller");
const shopController = require("../../controllers/shop/shop.controller");

//shop Rouer
router.get("/shop", shopController.shop);

//shop single Router
router.get("/:slug", productController.productSingle);

//homeRouer
router.get("/categories", categoriesController.allCategories);

module.exports = router;
