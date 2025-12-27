const experss = require("express");
const router = experss.Router();


//controllers
const categoriesController = require("../../controllers/admin/categories/categories.controller");
const uploadCenterController = require("../../controllers/admin/uploadCenter.controller");
const brandController = require("../../controllers/admin/brand/brand.controller");
const productController = require("../../controllers/admin/product/product.controller");

//upload
const { upload_public } = require("../../utils/upload");

// //master page
// router.use((req, res, next) => {
//     res.locals.layout = "admin/master";
//     next();
//   });

/* +++++++ UPLOADCENTER +++++++ +++++++ +++++++ +++++++ +++++++ +++++++ +++++++ */
router.post('/uploadCenter', upload_public.single('file'), uploadCenterController.createLiara);
router.get('/uploadCenter/:id', uploadCenterController.findOne);
router.get('/uploadCenter',uploadCenterController.findMany);
/* ####### END ####### ####### ####### ####### ####### ####### ####### *
 * ################################################################### *
 */

//home
// router.get("/", adminController.admin);

//categories
router.post("/categories", categoriesController.createCategories);
router.post("/subCategories", categoriesController.createSubCategories);

//brand
router.post("/brand", brandController.create);

//product
router.post("/product", productController.create);

// //tag
// router.get("/tags", tagController.index);
// router.get("/tag/create", tagController.create);
// router.post("/tag/insert", tagController.insert);


module.exports = router;