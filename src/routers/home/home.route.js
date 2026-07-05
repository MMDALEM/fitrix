const experss = require("express");
const router = experss.Router();

//controllers
const homeController = require("../../controllers/home/home.controller");

//homeRouer
router.get("/", homeController.home);

//SEO
router.get("/robots.txt", homeController.robots);
router.get("/sitemap.xml", homeController.sitemap);

module.exports = router;
