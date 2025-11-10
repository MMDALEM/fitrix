const router = require("express").Router();
const { verifyUser, verifyAdmin } = require("../middlewares/auth.middleware");
const { verifyTokenPublic } = require("../middlewares/authPublic.middleware");
const { backTokenAuth } = require("../middlewares/backTokenAuth.middleware");
const { logout } = require("../controllers/auth/auth.controller");


const homeRouter = require("./home/home");
router.use("/", verifyTokenPublic,homeRouter);

const  authRouter  = require("./auth/auth");
router.use("/auth", backTokenAuth, authRouter);

const  shopRouter  = require("./shop/shop");
router.use("/shop", verifyTokenPublic, shopRouter);

const  dashboardRouter  = require("./dashboard/dashboard");
router.use("/dashboard", verifyUser, dashboardRouter);

const  adminRouter  = require("./admin/admin");
router.use("/admin", verifyAdmin, adminRouter);

router.use("/logout", logout);


module.exports = { AllRouters: router };