const experss = require("express");
const categoriesController = require("../../controllers/admin/categories/categories.controller");
const router = experss.Router();


//controllers
// const adminController = require("../../controllers/admin/admin.controller");
// const blogController = require("../../controllers/admin/blogs/blog.controller");
// const tagController = require("../../controllers/admin/tags/tag.controller");
// const { uploadFile } = require("../../utils/upload");
// const upload = uploadFile();

// //master page
// router.use((req, res, next) => {
//     res.locals.layout = "admin/master";
//     next();
//   });

// //home
// router.get("/", adminController.admin);

//categories
router.post("/categories", categoriesController.createCategories);
router.post("/subCategories", categoriesController.createSubCategories);

// //tag
// router.get("/tags", tagController.index);
// router.get("/tag/create", tagController.create);
// router.post("/tag/insert", tagController.insert);


module.exports = router;