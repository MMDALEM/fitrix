const experss = require("express");
const router = experss.Router();

//controllers


//payment
router.post("/payment/create", checkBasketAccess, paymentController.createPayment);
router.get("/payment/verify/:gateway", paymentController.verifyPayment);

module.exports = router;
