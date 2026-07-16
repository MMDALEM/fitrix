const mongoose = require("mongoose");

// تنظیمات سراسری سایت (تک‌سند / singleton)
const settingSchema = new mongoose.Schema(
  {
    // مالیات بر ارزش افزوده فعال است یا نه (ادمین می‌تواند خاموش کند)
    taxEnabled: {
      type: Boolean,
      default: true,
    },
    // نرخ مالیات (کسری اعشاری؛ مثلاً 0.1 برای ۱۰٪)
    taxRate: {
      type: Number,
      default: 0.1,
      min: 0,
      max: 1,
    },

    // ───── برنامه‌سازِ هوشمند (ورزشی + تغذیه) ─────
    // فعال/غیرفعال کردن کلِ سرویس از پنل ادمین
    programEnabled: {
      type: Boolean,
      default: true,
    },
    // قیمتِ نسخه‌ی کامل (تومان). حداقل ۵۰۰ تومان
    programPrice: {
      type: Number,
      default: 899000,
      min: 500,
    },
    // قیمتِ تخفیف‌خورده (تومان) — اگر تنظیم شود و از قیمت اصلی کمتر باشد،
    // مثل تخفیفِ محصولات روی صفحه اعمال می‌شود. null یعنی بدون تخفیف
    programSalePrice: {
      type: Number,
      default: 399000,
      min: 0,
    },
  },
  { timestamps: true },
);

// قیمتِ مؤثرِ برنامه (با در نظر گرفتنِ تخفیف)
settingSchema.methods.programEffectivePrice = function () {
  const base = Math.max(Number(this.programPrice) || 0, 500);
  const sale = Number(this.programSalePrice);
  if (Number.isFinite(sale) && sale > 0 && sale < base) return sale;
  return base;
};

// گرفتن تنها سند تنظیمات (در صورت نبود، ساخته می‌شود)
settingSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model("Setting", settingSchema);
