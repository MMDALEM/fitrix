const errorLogModel = require("../models/errorLog.model");

// ثبتِ یک خطای واقعی در دیتابیس (برای نمایش در تبِ «خطاها»ی ادمین).
// هرگز خودش throw نمی‌کند تا مسیرِ اصلیِ برنامه نشکند؛ در بدترین حالت فقط
// در کنسول لاگ می‌کند.
async function logError(err, { source = "server", req = null, meta = null, status } = {}) {
  try {
    const doc = {
      message: (err && err.message) || String(err) || "خطای نامشخص",
      source,
      status: status || (err && err.status) || 500,
      stack: (err && err.stack) || "",
      meta: meta ? (typeof meta === "string" ? meta : safeJson(meta)) : "",
    };
    if (req) {
      doc.method = req.method || "";
      doc.url = req.originalUrl || req.url || "";
      if (req.user && req.user._id) doc.user = req.user._id;
    }
    await errorLogModel.create(doc);
  } catch (e) {
    // ثبتِ لاگ نباید هیچ‌وقت برنامه را بشکند
    console.error("logError failed:", e.message);
  }
}

function safeJson(obj) {
  try {
    return JSON.stringify(obj).slice(0, 2000);
  } catch {
    return "";
  }
}

module.exports = { logError };
