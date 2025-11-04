const experss = require("express");
const router = experss.Router();

//controllers
const shopController = require("../../controllers/shop/shop.controller");

//homeRouer
router.get("/", shopController.shop);

module.exports = router;