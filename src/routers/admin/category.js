const experss = require("express");
const router = experss.Router();

//controllers
const categoriesController = require("../../controllers/admin/categories/categories.controller");
const upload_multer = require("../../utils/multer");

//categories render
router.get("/", categoriesController.category);

//categories
router.post(
  "/",
  upload_multer.single("image"),
  categoriesController.createCategories,
);
router.post("/subCategories", categoriesController.createSubCategories);

module.exports = router;
