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
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    AED: {
      type: Number,
      required: true,
      min: 0,
    },
    // درصد سود
    darsad: {
      highNumber: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      single: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
    },
    // موجودی انبار
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    // قیمت تخفیف خورده (برای فروش ویژه)
    salePrice: {
      type: Number,
      min: 0,
      default: null,
    },
    // آیا در فروش ویژه هست؟
    onSale: {
      type: Boolean,
      default: false,
      index: true,
    },
    // تاریخ شروع و پایان فروش ویژه
    saleStartDate: {
      type: Date,
      default: null,
    },
    // تاریخ پایان فروش ویژه
    saleEndDate: {
      type: Date,
      default: null,
    },
    image: {
      type: String,
      required: true,
    },
    // تعداد سروینگ (وعده)
    servings: {
      type: Number,
      min: 1,
    },
    // طعم محصول (شکلات، وانیل و...)
    flavor: {
      type: String,
      trim: true,
    },
    // وزن محصول (به گرم)
    weight: {
      type: String,
      min: 0,
    },
    // آیا محصول ویژه است؟
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    // تعداد فروش رفته
    soldCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // تعداد بازدیدها
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // وضعیت فعال بودن محصول
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

// Index برای جستجو
ProductSchema.index({ title: "text", description: "text" });

// Virtual برای محاسبه درصد تخفیف
ProductSchema.virtual("discountPercentage").get(function () {
  if (this.salePrice && this.salePrice < this.price) {
    return Math.round(((this.price - this.salePrice) / this.price) * 100);
  }
  return 0;
});

// Virtual برای قیمت نهایی
ProductSchema.virtual("finalPrice").get(function () {
  if (this.onSale && this.salePrice && this.salePrice < this.price) {
    const now = new Date();
    if (
      (!this.saleStartDate || this.saleStartDate <= now) &&
      (!this.saleEndDate || this.saleEndDate >= now)
    ) {
      return this.salePrice;
    }
  }
  return this.price;
});

// Middleware برای بررسی خودکار وضعیت فروش ویژه
// ProductSchema.pre('save', function(next) {
//     const now = new Date();

//     // اگر تاریخ فروش ویژه گذشته باشد، onSale را false کن
//     if (this.onSale && this.saleEndDate && this.saleEndDate < now) {
//         this.onSale = false;
//     }

//     // اگر قیمت فروش بیشتر یا مساوی قیمت اصلی باشد، تخفیف را حذف کن
//     if (this.salePrice && this.salePrice >= this.price) {
//         this.salePrice = null;
//         this.onSale = false;
//     }

//     next();
// });

ProductSchema.plugin(mongoosepaginate);

module.exports = mongoose.model("Product", ProductSchema);
