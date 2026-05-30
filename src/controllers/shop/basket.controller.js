const mongoose = require("mongoose");
const productModel = require("../../models/product.model");
const basketModel = require("../../models/basket.model");
const controller = require("../.controller");

// محاسبه‌ی قیمت فروش فعلی محصول
// (جایگزین virtual باگ‌دار finalPrice که به this.price اشاره می‌کرد و وجود نداشت)

function getCurrentPrice(product) {
  const base = product.priceSingle;

  if (product.onSale && product.salePrice && product.salePrice < base) {
    const now = new Date();
    const started = !product.saleStartDate || product.saleStartDate <= now;
    const notEnded = !product.saleEndDate || product.saleEndDate >= now;
    if (started && notEnded) return product.salePrice;
  }

  return base;
}

// فیلدهایی که هنگام populate محصول برای نمایش در سبد لازم داریم
const PRODUCT_SELECT =
  "title image slug priceSingle salePrice onSale quantity isActive";

class basketController extends controller {
  // گرفتن سبد کاربر فعلی
  async getBasket(req, res, next) {
    try {
      const userId = req.user._id;

      const basket = await basketModel.getOrCreate(userId);
      await basket.populate("items.product", PRODUCT_SELECT);

      return res.render("shop/basket", { basket });
    } catch (err) {
      next(err);
    }
  }

  // افزودن محصول به سبد
  async addToBasket(req, res, next) {
    try {
      const userId = req.user._id;
      const { productId, quantity = 1 } = req.body;
      const qty = Number(quantity);

      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "شناسه محصول معتبر نیست" });
      }
      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({
          success: false,
          message: "تعداد باید عدد صحیح و حداقل ۱ باشد",
        });
      }

      const product = await productModel.findById(productId);
      if (!product || !product.isActive) {
        return res
          .status(404)
          .json({ success: false, message: "محصول یافت نشد" });
      }

      const basket = await basketModel.getOrCreate(userId);

      // تعداد فعلی همین محصول در سبد + تعداد جدید نباید از موجودی بیشتر شود
      const existing = basket.items.find(
        (i) => i.product.toString() === productId.toString(),
      );
      const currentQty = existing ? existing.quantity : 0;

      if (currentQty + qty > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `موجودی کافی نیست (موجودی فعلی: ${product.quantity})`,
        });
      }

      // قیمت همیشه سمت سرور محاسبه می‌شود، نه از روی ورودی کاربر
      const price = getCurrentPrice(product);
      await basket.addItem(productId, qty, price);
      await basket.populate("items.product", PRODUCT_SELECT);

      return res.json({
        success: true,
        message: "محصول به سبد اضافه شد",
        basket,
      });
    } catch (err) {
      next(err);
    }
  }

  // تغییر تعداد یک محصول (تعداد ۰ یا کمتر = حذف)
  async updateItem(req, res, next) {
    try {
      const userId = req.user._id;
      const { productId, quantity } = req.body;
      const qty = Number(quantity);

      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "شناسه محصول معتبر نیست" });
      }
      if (!Number.isInteger(qty)) {
        return res
          .status(400)
          .json({ success: false, message: "تعداد باید عدد صحیح باشد" });
      }

      const basket = await basketModel.findOne({ user: userId });
      if (!basket) {
        return res
          .status(404)
          .json({ success: false, message: "سبد خرید یافت نشد" });
      }

      // اگر تعداد را افزایش می‌دهیم، موجودی محصول را بررسی کن
      if (qty > 0) {
        const product = await productModel.findById(productId);
        if (!product || !product.isActive) {
          return res
            .status(404)
            .json({ success: false, message: "محصول یافت نشد" });
        }
        if (qty > product.quantity) {
          return res.status(400).json({
            success: false,
            message: `موجودی کافی نیست (موجودی فعلی: ${product.quantity})`,
          });
        }
      }

      await basket.updateQuantity(productId, qty);
      await basket.populate("items.product", PRODUCT_SELECT);

      return res.json({ success: true, message: "سبد به‌روزرسانی شد", basket });
    } catch (err) {
      next(err);
    }
  }

  // حذف یک محصول از سبد
  async removeFromBasket(req, res, next) {
    try {
      const userId = req.user._id;
      const { productId } = req.params;

      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "شناسه محصول معتبر نیست" });
      }

      const basket = await basketModel.findOne({ user: userId });
      if (!basket) {
        return res
          .status(404)
          .json({ success: false, message: "سبد خرید یافت نشد" });
      }

      await basket.removeItem(productId);
      await basket.populate("items.product", PRODUCT_SELECT);

      return res.json({
        success: true,
        message: "محصول از سبد حذف شد",
        basket,
      });
    } catch (err) {
      next(err);
    }
  }

  // خالی کردن کامل سبد
  async clearBasket(req, res, next) {
    try {
      const userId = req.user._id;

      const basket = await basketModel.findOne({ user: userId });
      if (!basket) {
        return res
          .status(404)
          .json({ success: false, message: "سبد خرید یافت نشد" });
      }

      await basket.clear();

      return res.json({ success: true, message: "سبد خرید خالی شد", basket });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new basketController();
