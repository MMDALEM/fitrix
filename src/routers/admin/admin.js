const experss = require("express");
const router = experss.Router();


//controllers
const categoriesController = require("../../controllers/admin/categories/categories.controller");
const uploadCenterController = require("../../controllers/admin/uploadCenter.controller");

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

// //tag
// router.get("/tags", tagController.index);
// router.get("/tag/create", tagController.create);
// router.post("/tag/insert", tagController.insert);


module.exports = router;