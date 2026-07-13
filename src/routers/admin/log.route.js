const express = require("express");
const router = express.Router();

const logController = require("../../controllers/admin/log/log.controller");

// لایوت ادمین
router.use((req, res, next) => {
  res.locals.layout = "admin/master";
  next();
});

router.get("/", logController.index);
router.post("/read-all", logController.markAllRead);
router.post("/clear", logController.clearAll);
router.post("/:id/delete", logController.deleteOne);

module.exports = router;
