const mongoose = require("mongoose");

// ثبت تسویه‌حساب با هر شریک — مبلغی که به آن شریک پرداخت/منتقل شده است.
const settlementSchema = new mongoose.Schema(
  {
    // کدام شریک: partner1 | partner2
    partner: {
      type: String,
      required: true,
      enum: ["partner1", "partner2"],
      index: true,
    },
    amount: { type: Number, required: true, min: 0 }, // تومان
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Settlement", settlementSchema);
