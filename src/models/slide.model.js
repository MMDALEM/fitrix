const mongoose = require("mongoose");

// اسلاید بنر صفحه اصلی (اسلایدشو) — قابل مدیریت از پنل ادمین
const slideSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    // لینک مقصد هنگام کلیک روی اسلاید
    link: { type: String, default: "/shop", trim: true, maxlength: 500 },
    // متن جایگزین تصویر (سئو/دسترسی‌پذیری)
    alt: { type: String, default: "", trim: true, maxlength: 200 },
    // ترتیب نمایش (کوچک‌تر = جلوتر)
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Slide", slideSchema);
