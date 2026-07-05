const experss = require("express");
const router = experss.Router();

//controllers
const consultController = require("../../controllers/consult/consult.controller");

// صفحه‌ی مشاوره رایگان با هوش مصنوعی
router.get("/", consultController.page);

// API گفتگو
router.post("/ask", consultController.ask);

module.exports = router;
