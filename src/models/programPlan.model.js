const mongoose = require("mongoose");
const { Schema } = mongoose;

// یک تمرینِ واحد داخلِ یک روز
const exerciseSchema = new Schema(
  {
    name: String,
    sets: String,
    reps: String,
    rest: String,
    note: String,
  },
  { _id: false },
);

// یک روزِ تمرینی
const daySchema = new Schema(
  {
    day: String, // «روز ۱ - سینه و جلوبازو»
    focus: String,
    exercises: [exerciseSchema],
  },
  { _id: false },
);

// یک وعده‌ی غذایی — همراه با کالریِ تقریبیِ وعده
const mealSchema = new Schema(
  { name: String, items: [String], calories: String, note: String },
  { _id: false },
);

// یک مکملِ پیشنهادی که به محصولِ فروشگاه لینک می‌شود (فقط نسخه‌ی پولی).
// dose (مقدار)، timing (زمانِ مصرف) و priority (ضروری/مکمل/اختیاری) برای
// حرفه‌ای‌تر و دقیق‌تر شدنِ توصیه‌ی مکمل اضافه شده‌اند.
const supplementSchema = new Schema(
  {
    title: String,
    slug: String,
    reason: String,
    dose: String,
    timing: String,
    priority: String,
  },
  { _id: false },
);

// پرسش‌وپاسخِ پیگیری درباره‌ی برنامه (فقط نسخه‌ی پولی)
const qaSchema = new Schema(
  { q: String, a: String, at: { type: Date, default: Date.now } },
  { _id: false },
);

const programPlanSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ───── ورودیِ فرم (اطلاعاتِ کاربر) ─────
    fullName: { type: String, default: "", trim: true, maxlength: 80 },
    gender: { type: String, enum: ["male", "female"], required: true },
    age: { type: Number, min: 12, max: 90, required: true },
    height: { type: Number, min: 120, max: 230, required: true }, // سانتی‌متر
    weight: { type: Number, min: 30, max: 250, required: true }, // کیلوگرم
    goal: { type: String, required: true }, // muscle | fatloss | recomp | strength | endurance | fitness
    bodyType: { type: String, default: "" }, // ecto | meso | endo | unknown
    experience: { type: String, default: "beginner" }, // beginner | intermediate | advanced
    daysPerWeek: { type: Number, min: 1, max: 7, default: 3 },
    place: { type: String, default: "gym" }, // gym | home | none
    activity: { type: String, default: "moderate" }, // sedentary | light | moderate | active | very
    injuries: { type: String, default: "" },
    diet: { type: String, default: "" }, // محدودیت غذایی
    budget: { type: Number, default: 0 }, // بودجه‌ی مکمل (تومان)

    // ───── محاسبه‌ی سمت سرور (بدون AI) ─────
    metrics: {
      bmr: Number,
      tdee: Number,
      calories: Number,
      protein: Number,
      carb: Number,
      fat: Number,
      bmi: Number,
    },

    // ───── وضعیت ─────
    // برنامه همیشه کامل ساخته می‌شود؛ تا وقتی unlocked نشده فقط روز اول
    // (پیش‌نمایش) نشان داده می‌شود و بقیه با پرداخت باز می‌شود.
    unlocked: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "generating", "ready", "failed"],
      default: "draft",
      index: true,
    },

    // ───── خروجیِ برنامه ─────
    title: String,
    summary: String,
    weeklyPlan: [daySchema],
    nutrition: {
      overview: String,
      meals: [mealSchema],
      tips: [String],
    },
    supplements: [supplementSchema],
    qa: [qaSchema],

    // ───── پرداخت ─────
    price: { type: Number, default: 0 },
    gateway: String,
    transactionId: String,
    providerId: String, // مخصوصِ دیجی‌پی
    refId: String,
    paidAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("ProgramPlan", programPlanSchema);
