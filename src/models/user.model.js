const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 50,
    },
    username: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },
    password: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      default: "",
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "لطفا یک ایمیل معتبر وارد کنید"],
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^09[0-9]{9}$/, "شماره موبایل معتبر نیست"],
    },
    otp: {
      code: {
        type: Number,
      },
      expiresIn: {
        type: Number,
      },
    },
    roles: {
      type: [String],
      enum: ["USER", "ADMIN", "SUPER_ADMIN"],
      default: ["USER"],
    },
    cart: {
      items: [
        {
          product: {
            type: mongoose.Schema.Types.ObjectId,
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
          },
          addedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      totalPrice: {
        type: Number,
        default: 0,
        min: 0,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    addresses: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
    },
    avatar: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Virtual برای نام کامل
UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim() || "کاربر";
});

// Virtual برای تعداد محصولات در سبد
UserSchema.virtual("cartItemsCount").get(function () {
  if (!this.cart || !this.cart.items) return 0;
  return this.cart.items.reduce((total, item) => total + item.quantity, 0);
});

// متد برای اضافه کردن محصول به سبد
UserSchema.methods.addToCart = function (productId, quantity = 1, price) {
  // پیدا کردن محصول در سبد
  const cartItemIndex = this.cart.items.findIndex(
    (item) => item.product.toString() === productId.toString(),
  );

  if (cartItemIndex >= 0) {
    // اگر محصول قبلاً در سبد بود، تعداد را افزایش بده
    this.cart.items[cartItemIndex].quantity += quantity;
    this.cart.items[cartItemIndex].price = price; // آپدیت قیمت
  } else {
    // محصول جدید به سبد اضافه کن
    this.cart.items.push({
      product: productId,
      quantity: quantity,
      price: price,
      addedAt: new Date(),
    });
  }

  this.cart.updatedAt = new Date();
  return this.save();
};

// متد برای حذف محصول از سبد
UserSchema.methods.removeFromCart = function (productId) {
  this.cart.items = this.cart.items.filter(
    (item) => item.product.toString() !== productId.toString(),
  );
  this.cart.updatedAt = new Date();
  return this.save();
};

// متد برای آپدیت تعداد محصول در سبد
UserSchema.methods.updateCartItemQuantity = function (productId, quantity) {
  const cartItem = this.cart.items.find(
    (item) => item.product.toString() === productId.toString(),
  );

  if (cartItem) {
    if (quantity <= 0) {
      // اگر تعداد صفر یا منفی شد، محصول را حذف کن
      return this.removeFromCart(productId);
    }
    cartItem.quantity = quantity;
    this.cart.updatedAt = new Date();
    return this.save();
  }

  return Promise.resolve(this);
};

// متد برای خالی کردن سبد
UserSchema.methods.clearCart = function () {
  this.cart.items = [];
  this.cart.totalPrice = 0;
  this.cart.updatedAt = new Date();
  return this.save();
};

// متد برای محاسبه مجموع قیمت سبد
// UserSchema.methods.calculateCartTotal = async function() {
//     await this.populate('cart.items.product');

//     let total = 0;
//     for (const item of this.cart.items) {
//         if (item.product) {
//             // استفاده از قیمت نهایی محصول (با احتساب تخفیف فروش ویژه)
//             const finalPrice = item.product.finalPrice || item.product.price;
//             total += finalPrice * item.quantity;
//         }
//     }

//     this.cart.totalPrice = total;
//     return total;
// };

// متد برای اضافه کردن به لیست علاقه‌مندی
// UserSchema.methods.addToWishlist = function(productId) {
//     if (!this.wishlist.includes(productId)) {
//         this.wishlist.push(productId);
//         return this.save();
//     }
//     return Promise.resolve(this);
// };

// متد برای حذف از لیست علاقه‌مندی
// UserSchema.methods.removeFromWishlist = function(productId) {
//     this.wishlist = this.wishlist.filter(
//         id => id.toString() !== productId.toString()
//     );
//     return this.save();
// };

UserSchema.index({ email: 1, isActive: 1 });
UserSchema.index({ phone: 1, isActive: 1 });
UserSchema.index({ username: 1, isActive: 1 });

module.exports = mongoose.model("User", UserSchema);
