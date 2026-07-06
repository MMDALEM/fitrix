const mongoose = require("mongoose");

// اعلان‌ها: هم برای ادمین‌ها (سفارش جدید) و هم برای کاربر (تشکر از خرید / وضعیت سفارش)
const notificationSchema = new mongoose.Schema(
  {
    // مخاطب: admin = همه‌ی ادمین‌ها، user = یک کاربر مشخص
    audience: {
      type: String,
      enum: ["admin", "user"],
      default: "admin",
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    type: { type: String, default: "order" }, // order | system
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, default: "", trim: true, maxlength: 1000 },
    // سفارش مرتبط (اختیاری)
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Basket",
      default: null,
    },
    link: { type: String, default: null },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ audience: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
