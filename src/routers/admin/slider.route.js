const express = require("express");
const router = express.Router();

const sliderController = require("../../controllers/admin/slider/slider.controller");
const upload_multer = require("../../utils/multer");

// لایوت ادمین
router.use((req, res, next) => {
  res.locals.layout = "admin/master";
  next();
});

router.get("/", sliderController.index);
router.post("/create", upload_multer.single("image"), sliderController.create);
router.post("/:id/toggle", sliderController.toggle);
router.post("/:id/delete", sliderController.remove);

module.exports = router;
