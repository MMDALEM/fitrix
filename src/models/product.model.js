const mongoose = require("mongoose");
const { Schema } = mongoose;
const mongoosepaginate = require("mongoose-paginate-v2");

const ProductSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categories",
      required: true,
      index: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    ingredients: {
      type: String,
      trim: true,
    },
    usage: {
      type: String,
      trim: true,
    },
    popularity: {
      type: Boolean,
      default: false,
    },
    howToUse: {
      type: String,
      trim: true,
    },
    // قیمت خام درهم — مرجع حقیقت، فقط ادمین تغییرش می‌دهد
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    // قیمت تکی (تومان) — بر اساس درصد تکی
    priceSingle: {
      type: Number,
      required: true,
      min: 0,
    },
    // قیمت‌های عمده (تومان) — بر اساس درصدهای ثابت ۵/۱۰/۱۵/۲۰
    priceHigh5: {
      type: Number,
      required: true,
      min: 0,
    },
    priceHigh10: {
      type: Number,
      required: true,
      min: 0,
    },
    priceHigh15: {
      type: Number,
      required: true,
      min: 0,
    },
    priceHigh20: {
      type: Number,
      required: true,
      min: 0,
    },
    // نرخ لحظه‌ی درهم در زمان آخرین محاسبه
    AED: {
      type: Number,
      required: true,
      min: 0,
    },
    // درصدها: عمده‌ها ثابت‌اند، فقط تکی متغیر است
    darsad: {
      single: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      highNumber5: {
        type: Number,
        default: 5,
      },
      highNumber10: {
        type: Number,
        default: 10,
      },
      highNumber15: {
        type: Number,
        default: 15,
      },
      highNumber20: {
        type: Number,
        default: 20,
      },
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    salePrice: {
      type: Number,
      min: 0,
      default: null,
    },
    onSale: {
      type: Boolean,
      default: false,
      index: true,
    },
    saleStartDate: {
      type: Date,
      default: null,
    },
    saleEndDate: {
      type: Date,
      default: null,
    },
    image: {
      type: String,
      required: true,
    },
    servings: {
      type: Number,
      min: 1,
    },
    flavor: {
      type: String,
      trim: true,
    },
    weight: {
      type: String,
      min: 0,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    soldCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

ProductSchema.index({ title: "text", description: "text" });

ProductSchema.plugin(mongoosepaginate);

module.exports = mongoose.model("Product", ProductSchema);
