const experss = require("express");
const router = experss.Router();

//controllers
const categoriesController = require("../../controllers/product/categories/categories.controller");


//homeRouer
router.get("/categories", categoriesController.allCategories);

module.exports = router;