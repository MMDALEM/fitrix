const router = require("express").Router();
const { verifyUser, verifyAdmin } = require("../middlewares/auth.middleware");
const { verifyTokenPublic } = require("../middlewares/authPublic.middleware");
const { checkBasketAccess } = require("../middlewares/basket.middleware");
const { updateExchangeRate } = require("../services/exchangeRate.service");
const { logout } = require("../controllers/auth/auth.controller");

const homeRouter = require("./home/home");
router.use("/", homeRouter);

const productRouter = require("./product/product");
router.use("/product", productRouter);

const authRouter = require("./auth/auth");
router.use("/auth", authRouter);

const shopRouter = require("./shop/shop");
router.use("/shop", verifyTokenPublic, shopRouter);

const basketRouter = require("./shop/basket");
router.use("/basket", checkBasketAccess, basketRouter);

const dashboardRouter = require("./dashboard/dashboard");
router.use("/dashboard", verifyUser, dashboardRouter);

//admin routers
const adminRouter = require("./admin/admin");
router.use("/admin", adminRouter);

const productAdminRouter = require("./admin/product");
router.use("/admin/product", productAdminRouter);

const brandAdminRouter = require("./admin/brand");
router.use("/admin/brand", brandAdminRouter);

const categoryAdminRouter = require("./admin/category");
router.use("/admin/category", categoryAdminRouter);

const adminPdfRouter = require("./admin/pdf");
router.use("/admin/pdf", adminPdfRouter);

router.get("/update-exchange-rate", async (req, res, next) => {
  await updateExchangeRate(req, res, next);
  res.json({ success: true, message: "نرخ ارز آپدیت شد" });
});

router.use("/logout", logout);

module.exports = { AllRouters: router };
