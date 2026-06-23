const router = require("express").Router();
const { verifyUser, verifyAdmin } = require("../middlewares/auth.middleware");
const { verifyTokenPublic } = require("../middlewares/authPublic.middleware");
const { checkBasketAccess } = require("../middlewares/basket.middleware");
const { logout } = require("../controllers/auth/auth.controller");

const homeRouter = require("./home/home.route");
router.use("/", homeRouter);

const productRouter = require("./product/product.route");
router.use("/product", productRouter);

const authRouter = require("./auth/auth.route");
router.use("/auth", authRouter);

const shopRouter = require("./shop/shop.route");
router.use("/shop", verifyTokenPublic, shopRouter);

const basketRouter = require("./shop/basket.route");
router.use("/basket", checkBasketAccess, basketRouter);

const dashboardRouter = require("./dashboard/dashboard.route");
router.use("/dashboard", verifyUser, dashboardRouter);

//admin routers
const adminRouter = require("./admin/admin.route");
router.use("/admin", adminRouter);

const productAdminRouter = require("./admin/product.route");
router.use("/admin/product", productAdminRouter);

const brandAdminRouter = require("./admin/brand.route");
router.use("/admin/brand", brandAdminRouter);

const categoryAdminRouter = require("./admin/category.route");
router.use("/admin/category", categoryAdminRouter);

const adminPdfRouter = require("./admin/pdf.route");
router.use("/admin/pdf", adminPdfRouter);

router.use("/logout", logout);

module.exports = { AllRouters: router };
