const mongoose = require("mongoose");

// هزینه‌های اضافه‌ی کسب‌وکار (بسته‌بندی، تبلیغات، اجاره و ...)
// این هزینه‌ها قبل از تقسیم سود بین شرکا کسر می‌شوند.
const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 }, // تومان
    note: { type: String, trim: true, maxlength: 500 },
    // آیا این هزینه تسویه/پرداخت شده است؟ (به‌جای حذف، علامت می‌خورد تا رکورد بماند)
    settled: { type: Boolean, default: false },
    settledAt: { type: Date, default: null },
    // کاربری که هزینه را ثبت کرده
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Expense", expenseSchema);
