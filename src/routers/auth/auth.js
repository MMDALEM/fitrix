const experss = require("express");
const router = experss.Router();

//controllers
const authController = require("../../controllers/auth/auth.controller");

//auth Rouer
router.get("/", authController.auth);
router.post("/", authController.verifyAuth);

//otp Rouer
router.get("/otp", authController.otp);
router.post("/otp", authController.verifyOtp);

module.exports = router;