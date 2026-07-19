// روت‌های Torob Product API v3
// همه‌ی درخواست‌ها با توکنِ EdDSA ِ ترب احراز هویت می‌شوند (torobAuth).
const router = require("express").Router();
const { torobAuth } = require("../../utils/torobToken");
const torobController = require("../../controllers/torob/torob.controller");

// اندپوینتِ اصلی — ترب با POST محصولات را می‌گیرد
router.post("/v3/products", torobAuth, torobController.products);

module.exports = router;
