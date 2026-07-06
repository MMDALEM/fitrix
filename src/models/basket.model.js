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
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // قیمت کامل (قبل از تخفیف محصول) — برای گزارش حسابداری/تفکیک تخفیف‌ها
    fullPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    // درصد تخفیف محصول در لحظه‌ی افزودن به سبد
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
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
    // هر کاربر در هر لحظه فقط یک سبد «active» دارد؛ سبدهای «paid»
    // به‌عنوان تاریخچه‌ی سفارش‌ها باقی می‌مانند، پس user دیگر unique نیست.
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [BasketItemSchema],
    // وضعیت سبد:
    //  active           = سبد جاری کاربر (در حال خرید)
    //  pending_payment  = در انتظار بازگشت از درگاه
    //  paid             = پرداخت‌شده (به‌عنوان سفارش باقی می‌ماند)
    //  cancelled        = لغو/ناموفق
    status: {
      type: String,
      enum: ["active", "pending_payment", "paid", "cancelled"],
      default: "active",
      index: true,
    },
    statusLabel: {
      type: String,
      default: "سبد خرید",
    },
    // مجموع قیمت اقلام (قبل از مالیات/تخفیف)
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ───── اطلاعات سفارش (هنگام نهایی‌سازی/پرداخت پر می‌شوند) ─────
    orderNumber: { type: String, default: null, index: true },
    shippingAddress: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      default: null,
    },
    shippingDetails: {
      receiver: String,
      phone: String,
      address: String,
      postalCode: String,
    },
    paymentMethod: { type: String, default: null }, // zarinpal | digipay
    paymentMethodLabel: { type: String, default: null },
    taxPrice: { type: Number, default: 0, min: 0 },
    discountCode: {
      type: Schema.Types.ObjectId,
      ref: "Discount",
      default: null,
    },
    discountCodeString: { type: String, default: null },
    discountAmount: { type: Number, default: 0, min: 0 },
    // مبلغ نهایی قابل پرداخت (اقلام - تخفیف + مالیات)
    finalPrice: { type: Number, default: 0, min: 0 },
    transactionId: { type: String, default: null },
    isPaid: { type: Boolean, default: false, index: true },
    paidAt: { type: Date, default: null },
    // ───── وضعیت ارسال (پنل ادمین) ─────
    isShipped: { type: Boolean, default: false, index: true },
    shippedAt: { type: Date, default: null },
    trackingCode: { type: String, default: null },
    shippingNote: { type: String, default: null },
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

// ایندکس ترکیبی برای یافتن سریع سبدِ فعال/پرداخت‌شده‌ی هر کاربر
// (نامِ این ایندکس user_1_status_1 است و با ایندکس قدیمیِ unique تداخل ندارد)
BasketSchema.index({ user: 1, status: 1 });

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
BasketSchema.methods.addItem = function (
  productId,
  quantity = 1,
  price,
  fullPrice = null,
  discountPercent = 0,
) {
  const index = this.items.findIndex(
    (item) => item.product.toString() === productId.toString(),
  );

  if (index > -1) {
    this.items[index].quantity += quantity;
    if (price != null) this.items[index].price = price; // آپدیت قیمت
    if (fullPrice != null) this.items[index].fullPrice = fullPrice;
    this.items[index].discountPercent = discountPercent || 0;
  } else {
    this.items.push({
      product: productId,
      quantity,
      price,
      fullPrice: fullPrice != null ? fullPrice : price,
      discountPercent: discountPercent || 0,
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

// گرفتن سبدِ «فعالِ» کاربر یا ساختن یک سبد فعال جدید اگر وجود نداشت
BasketSchema.statics.getOrCreate = async function (userId) {
  let basket = await this.findOne({ user: userId, status: "active" });
  if (!basket) {
    basket = await this.create({ user: userId, status: "active", items: [] });
  }
  return basket;
};

// تولید شماره سفارش یکتا (مثل ORD2406240001)
BasketSchema.statics.generateOrderNumber = async function () {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
  const endOfDay = new Date(new Date().setHours(23, 59, 59, 999));
  const todayPaid = await this.countDocuments({
    orderNumber: { $ne: null },
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const seq = String(todayPaid + 1).padStart(4, "0");
  return `ORD${y}${m}${d}${seq}`;
};

// علامت‌گذاری سبد به‌عنوان پرداخت‌شده
BasketSchema.methods.markPaid = function (transactionId = null) {
  this.status = "paid";
  this.statusLabel = "پرداخت شده";
  this.isPaid = true;
  this.paidAt = new Date();
  if (transactionId) this.transactionId = transactionId;
  return this.save();
};

// علامت‌گذاری سفارش به‌عنوان «ارسال‌شده»
BasketSchema.methods.markShipped = function (trackingCode = null, note = null) {
  this.isShipped = true;
  this.shippedAt = new Date();
  this.statusLabel = "ارسال شده";
  if (trackingCode) this.trackingCode = trackingCode;
  if (note) this.shippingNote = note;
  return this.save();
};

// بازمحاسبه‌ی مجموع و به‌روزرسانی زمان فعالیت پیش از هر ذخیره
// BasketSchema.pre("save", function (next) {
//   this.calculateTotal();
//   this.lastActivity = new Date();
//   next();
// });

module.exports = mongoose.model("Basket", BasketSchema);
