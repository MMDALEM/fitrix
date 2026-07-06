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
  },
  { timestamps: true },
);

// گرفتن تنها سند تنظیمات (در صورت نبود، ساخته می‌شود)
settingSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model("Setting", settingSchema);
