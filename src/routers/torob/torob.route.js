// روت‌های Torob Product API v3
// همه‌ی درخواست‌های واقعیِ ترب POST هستند و با توکنِ EdDSA احراز می‌شوند.
const router = require("express").Router();
const { torobAuth } = require("../../utils/torobToken");
const torobController = require("../../controllers/torob/torob.controller");

// اندپوینتِ اصلی — ترب با POST محصولات را می‌گیرد
router.post("/v3/products", torobAuth, torobController.products);

// GET فقط برای بررسیِ سلامتِ اندپوینت در مرورگر (ترب از آن استفاده نمی‌کند).
// چون درخواستِ واقعی POST است، مرورگر (GET) این پیام را می‌بیند نه ۴۰۴.
router.get("/v3/products", (req, res) => {
  res
    .status(405)
    .json({
      ok: true,
      message:
        "Torob Product API v3 فعال است. این اندپوینت فقط با متدِ POST و توکنِ X-Torob-Token کار می‌کند.",
      method_expected: "POST",
    });
});

module.exports = router;
