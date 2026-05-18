const experss = require("express");
const router = experss.Router();

//controllers
const brandController = require("../../controllers/admin/brand/brand.controller");
const upload_multer = require("../../utils/multer");

//product render
router.get("/", brandController.brand);

//brand
router.post("/", upload_multer.single("image"), brandController.create);

module.exports = router;
