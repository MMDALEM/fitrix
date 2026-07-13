const mongoose = require("mongoose");

// لاگِ خطاهای واقعیِ سرور — برای نمایش در پنل ادمین (تبِ «خطاها»)
const ErrorLogSchema = new mongoose.Schema(
  {
    message: { type: String, default: "" },
    // منبع/برچسب خطا (مثلاً "digipay-verify"، "product-edit"، "server")
    source: { type: String, default: "server", index: true },
    status: { type: Number, default: 500 },
    method: { type: String, default: "" },
    url: { type: String, default: "" },
    stack: { type: String, default: "" },
    // اطلاعات کمکی (JSON کوتاه)
    meta: { type: String, default: "" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// نگه‌داشتنِ خودکارِ لاگ‌ها برای ۳۰ روز تا دیتابیس شلوغ نشود
ErrorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("ErrorLog", ErrorLogSchema);
