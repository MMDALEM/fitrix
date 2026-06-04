const mongoose = require("mongoose");
const { Schema } = mongoose;

// آیتم‌های داخل سبد به‌صورت subdocument بدون _id مجزا
const BasketItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    // قیمت لحظه‌ی افزودن (snapshot) — صرفاً برای نمایش سریع در سبد.
    // ⚠️ هنگام نهایی‌سازی سفارش حتماً دوباره از روی محصول واقعی محاسبه شود،
    // چون قیمت محصول ممکن است بعد از افزودن به سبد تغییر کرده باشد.
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const BasketSchema = new Schema(
  {
    // هر کاربر فقط یک سبد فعال دارد
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: [BasketItemSchema],
    // مجموع قیمت سبد — در pre('save') به‌صورت خودکار بازمحاسبه می‌شود
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    // آخرین فعالیت روی سبد (برای گزارش سبدهای رهاشده یا پاکسازی)
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    // بدون این دو خط، virtual ها در پاسخ JSON دیده نمی‌شوند
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// تعداد کل اقلام داخل سبد
BasketSchema.virtual("totalItems").get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// خالی بودن سبد
BasketSchema.virtual("isEmpty").get(function () {
  return this.items.length === 0;
});

// محاسبه‌ی مجموع قیمت از روی آیتم‌ها
BasketSchema.methods.calculateTotal = function () {
  this.totalPrice = this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  return this.totalPrice;
};

// افزودن محصول به سبد (یا افزایش تعداد در صورت وجود)
BasketSchema.methods.addItem = function (productId, quantity = 1, price) {
  const index = this.items.findIndex(
    (item) => item.product.toString() === productId.toString(),
  );

  if (index > -1) {
    this.items[index].quantity += quantity;
    if (price != null) this.items[index].price = price; // آپدیت قیمت
  } else {
    this.items.push({
      product: productId,
      quantity,
      price,
      addedAt: new Date(),
    });
  }

  return this.save();
};

// حذف کامل یک محصول از سبد
BasketSchema.methods.removeItem = function (productId) {
  this.items = this.items.filter(
    (item) => item.product.toString() !== productId.toString(),
  );
  return this.save();
};

// تغییر تعداد یک محصول (تعداد ۰ یا کمتر = حذف)
BasketSchema.methods.updateQuantity = function (productId, quantity) {
  const item = this.items.find(
    (i) => i.product.toString() === productId.toString(),
  );

  if (!item) return Promise.resolve(this);

  if (quantity <= 0) {
    return this.removeItem(productId);
  }

  item.quantity = quantity;
  return this.save();
};

// خالی کردن سبد
BasketSchema.methods.clear = function () {
  this.items = [];
  this.totalPrice = 0;
  return this.save();
};

// گرفتن سبد کاربر یا ساختن سبد جدید اگر وجود نداشت
BasketSchema.statics.getOrCreate = async function (userId) {
  return this.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { upsert: true, setDefaultsOnInsert: true },
  );
};

// بازمحاسبه‌ی مجموع و به‌روزرسانی زمان فعالیت پیش از هر ذخیره
// BasketSchema.pre("save", function (next) {
//   this.calculateTotal();
//   this.lastActivity = new Date();
//   next();
// });

module.exports = mongoose.model("Basket", BasketSchema);
