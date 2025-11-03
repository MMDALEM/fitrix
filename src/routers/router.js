const router = require("express").Router();

const homeRouter = require("./home/home");
router.use("/", homeRouter);

const  authRouter  = require("./auth/auth");
router.use("/auth", authRouter);

const  adminRouter  = require("./admin/admin");
router.use("/admin", adminRouter);

module.exports = { AllRouters: router };