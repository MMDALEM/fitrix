const experss = require("express");
const router = experss.Router();

//controllers
const basketController = require("../../controllers/shop/basket.controller");

//shop Rouer
router.get("/", basketController.getBasket);

module.exports = router;
