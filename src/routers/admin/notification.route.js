const express = require("express");
const router = express.Router();

const notificationController = require("../../controllers/admin/notification/notification.controller");

// لایوت ادمین
router.use((req, res, next) => {
  res.locals.layout = "admin/master";
  next();
});

router.get("/", notificationController.index);
router.post("/:id/delete", notificationController.remove);
router.post("/clear", notificationController.clearAll);

module.exports = router;
