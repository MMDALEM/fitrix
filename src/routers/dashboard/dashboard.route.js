const experss = require("express");
const router = experss.Router();

//controllers
const dashboradController = require("../../controllers/dashborad/dashborad.controller");

// //home Rouer
router.get("/", dashboradController.dashborad);
router.post("/profile", dashboradController.updateProfile);
router.get("/address", dashboradController.address);
router.post("/address", dashboradController.addAddress);
router.post("/address/ajax", dashboradController.addAddressAjax);
router.post("/address/:id", dashboradController.deleteAddress);

module.exports = router;
