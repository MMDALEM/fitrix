const experss = require("express");
const router = experss.Router();

//controllers
const categoriesController = require("../../controllers/product/categories/categories.controller");
const productController = require("../../controllers/product/product.controller");

//shop single Router 
router.get("/:slug", productController.shopSingle);

//homeRouer
router.get("/categories", categoriesController.allCategories);



module.exports = router;