const router = require("express").Router();
const { verifyUser, verifyAdmin } = require("../middlewares/auth.middleware");
const { verifyTokenPublic } = require("../middlewares/authPublic.middleware");
const { updateExchangeRate } = require("../services/exchangeRate.service");
const { logout } = require("../controllers/auth/auth.controller");


const homeRouter = require("./home/home");
router.use("/",homeRouter);

const  productRouter  = require("./product/product");
router.use("/product", productRouter);

const  authRouter  = require("./auth/auth");
router.use("/auth", authRouter);

const  shopRouter  = require("./shop/shop");
router.use("/shop", verifyTokenPublic, shopRouter);

const  dashboardRouter  = require("./dashboard/dashboard");
router.use("/dashboard", verifyUser, dashboardRouter);

const  adminRouter  = require("./admin/admin");
router.use("/admin", adminRouter);

router.post('/update-exchange-rate', async (req, res) => {
  await updateExchangeRate();
  res.json({ success: true, message: 'نرخ ارز آپدیت شد' });
});

router.use("/logout", logout);

module.exports = { AllRouters: router };