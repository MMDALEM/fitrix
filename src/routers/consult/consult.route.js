const experss = require("express");
const router = experss.Router();

const consultController = require("../../controllers/consult/consult.controller");

router.get("/", consultController.page);

router.post("/ask", consultController.ask);

module.exports = router;
