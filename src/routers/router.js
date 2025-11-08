const router = require("express").Router();
const { verifyUser, verifyAdmin } = require("../middlewares/auth.middleware");

const homeRouter = require("./home/home");
router.use("/", homeRouter);

const  authRouter  = require("./auth/auth");
router.use("/auth",  authRouter);

const  shopRouter  = require("./shop/shop");
router.use("/shop", shopRouter);

const  dashboardRouter  = require("./dashboard/dashboard");
router.use("/dashboard", verifyUser, dashboardRouter);

const  adminRouter  = require("./admin/admin");
router.use("/admin", verifyAdmin, adminRouter);

module.exports = { AllRouters: router };