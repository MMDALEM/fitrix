const experss = require("express");
const router = experss.Router();

//controllers
// const uploadCenterController = require("../../controllers/admin/uploadCenter.controller");
const authAdminController = require("../../controllers/admin/auth/auth.controller");
const { verifyAdmin } = require("../../middlewares/auth.middleware");

//upload
// const { upload_public } = require("../../utils/upload");
const adminController = require("../../controllers/admin/admin.controller");

// AED (محافظت‌شده)
router.get("/update-aed", verifyAdmin, adminController.updated_AED);
router.get("/update-prices", verifyAdmin, adminController.updateAllPrices);

// بک‌آپ کامل کل پایگاه داده (دانلود فایل — محافظت‌شده)
router.get("/backup", verifyAdmin, adminController.backupDatabase);

// تنظیمات سایت (مالیات و ...)
router.get("/settings", verifyAdmin, adminController.settingsPage);
router.post("/settings/tax", verifyAdmin, adminController.updateTax);

//master page
router.use((req, res, next) => {
  res.locals.layout = "admin/master";
  next();
});

/* +++++++ UPLOADCENTER +++++++ +++++++ +++++++ +++++++ +++++++ +++++++ +++++++ */
// router.post('/uploadCenter', upload_public.single('file'), uploadCenterController.createLiara);
// router.get("/uploadCenter/:id", uploadCenterController.findOne);
// router.get("/uploadCenter", uploadCenterController.findMany);
/* ####### END ####### ####### ####### ####### ####### ####### ####### *
 * ################################################################### *
 */

//home (داشبورد ادمین — محافظت‌شده)
router.get("/", verifyAdmin, adminController.admin);

//auth (باز — صفحه‌ی ورود ادمین)
router.get("/auth", authAdminController.auth);
router.post("/auth", authAdminController.verifyAuth);
router.get("/hashPassword", authAdminController.hashPassword);

// router.get("/logout", authAdminController.logout);
// router.get("/", adminController.admin);

// //tag
// router.get("/tags", tagController.index);
// router.get("/tag/create", tagController.create);
// router.post("/tag/insert", tagController.insert);

module.exports = router;
