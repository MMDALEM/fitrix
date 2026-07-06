const mongoose = require("mongoose");
const productModel = require("../../models/product.model");
const basketModel = require("../../models/basket.model");
const controller = require("../.controller");

// فیلدهای محصول که برای نمایش سبد لازم داریم
const PRODUCT_SELECT =
  "title image slug priceSingle salePrice salePercent onSale saleStartDate saleEndDate quantity flavor weight isActive";

class basketController extends controller {
  // گرفتن سبد فعال با خودترمیمی: اگر ایندکس قدیمیِ unique روی user باعث
  // خطای duplicate شد، در همین کنترلر آن را حذف و دوباره تلاش می‌کنیم.
  async getActiveBasket(userId) {
    try {
      return await basketModel.getOrCreate(userId);
    } catch (e) {
      if (e && e.code === 11000) {
        try {
          await basketModel.collection.dropIndex("user_1");
        } catch (_) {}
        return await basketModel.getOrCreate(userId);
      }
      throw e;
    }
  }

  // صفحه‌ی سبد خرید (رندر EJS)
  async getBasket(req, res, next) {
    try {
      const userId = req.user._id;

      const basket = await this.getActiveBasket(userId);
      await basket.populate("items.product", PRODUCT_SELECT);

      return res.render("shop/basket", {
        basket,
        pageTitle: "سبد خرید",
        noindex: true,
      });
    } catch (err) {
      next(err);
    }
  }

  // افزودن محصول به سبد (پاسخ JSON برای آپدیت زنده‌ی هدر)
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
        return res
          .status(400)
          .json({ success: false, message: "تعداد نامعتبر است" });
      }

      const product = await productModel.findById(
        mongoose.Types.ObjectId.createFromHexString(String(productId)),
      );
      if (!product || !product.isActive) {
        return res
          .status(404)
          .json({ success: false, message: "محصول یافت نشد" });
      }

      const basket = await this.getActiveBasket(userId);

      // تعداد فعلی همین محصول در سبد + جدید نباید از موجودی بیشتر شود
      const existing = basket.items.find(
        (i) => i.product.toString() === productId.toString(),
      );
      const currentQty = existing ? existing.quantity : 0;

      if (currentQty + qty > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `موجودی کافی نیست (موجودی: ${product.quantity})`,
        });
      }

      // قیمت همیشه سمت سرور تعیین می‌شود
      // اگر تخفیف محصول همین حالا فعال باشد (داخل بازه‌ی تاریخ) قیمت
      // تخفیف‌خورده اعمال می‌شود و قیمت کامل + درصد تخفیف برای گزارش
      // حسابداری روی آیتم ذخیره می‌شود
      const hasSale = product.saleIsActive();
      const effectivePrice = hasSale ? product.salePrice : product.priceSingle;
      const discountPercent = hasSale ? product.salePercent || 0 : 0;

      await basket.addItem(
        productId,
        qty,
        effectivePrice,
        product.priceSingle,
        discountPercent,
      );

      const totalItems = basket.items.reduce((s, i) => s + i.quantity, 0);

      return res.json({
        success: true,
        message: "محصول به سبد اضافه شد",
        totalItems, // برای آپدیت عدد هدر
        totalPrice: basket.totalPrice,
      });
    } catch (err) {
      next(err);
    }
  }

  // تغییر تعداد یک محصول (۰ یا کمتر = حذف)
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
          .json({ success: false, message: "تعداد نامعتبر است" });
      }

      const basket = await basketModel.findOne({
        user: userId,
        status: "active",
      });
      if (!basket) {
        return res
          .status(404)
          .json({ success: false, message: "سبد خرید یافت نشد" });
      }

      // اگر افزایش است، موجودی را بررسی کن
      if (qty > 0) {
        const product = await productModel.findById(
          mongoose.Types.ObjectId.createFromHexString(String(productId)),
        );
        if (!product || !product.isActive) {
          return res
            .status(404)
            .json({ success: false, message: "محصول یافت نشد" });
        }
        if (qty > product.quantity) {
          return res.status(400).json({
            success: false,
            message: `موجودی کافی نیست (موجودی: ${product.quantity})`,
          });
        }
      }

      await basket.updateQuantity(productId, qty);

      const totalItems = basket.items.reduce((s, i) => s + i.quantity, 0);

      return res.json({
        success: true,
        message: "سبد به‌روزرسانی شد",
        totalItems,
        totalPrice: basket.totalPrice,
      });
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

      const basket = await basketModel.findOne({
        user: userId,
        status: "active",
      });
      if (!basket) {
        return res
          .status(404)
          .json({ success: false, message: "سبد خرید یافت نشد" });
      }

      await basket.removeItem(productId);

      const totalItems = basket.items.reduce((s, i) => s + i.quantity, 0);

      return res.json({
        success: true,
        message: "محصول از سبد حذف شد",
        totalItems,
        totalPrice: basket.totalPrice,
      });
    } catch (err) {
      next(err);
    }
  }

  // خالی کردن کامل سبد
  async clearBasket(req, res, next) {
    try {
      const userId = req.user._id;

      const basket = await basketModel.findOne({
        user: userId,
        status: "active",
      });
      if (!basket) {
        return res
          .status(404)
          .json({ success: false, message: "سبد خرید یافت نشد" });
      }

      await basket.clear();

      return res.json({
        success: true,
        message: "سبد خرید خالی شد",
        totalItems: 0,
        totalPrice: 0,
      });
    } catch (err) {
      next(err);
    }
  }

  // فقط تعداد اقلام سبد (برای نمایش اولیه‌ی عدد هدر در هر صفحه)
  async getBasketCount(req, res, next) {
    try {
      const userId = req.user._id;
      const basket = await basketModel.findOne({
        user: userId,
        status: "active",
      });
      const totalItems = basket
        ? basket.items.reduce((s, i) => s + i.quantity, 0)
        : 0;
      return res.json({ success: true, totalItems });
    } catch (err) {
      next(err);
    }
  }

  async updateBulk(req, res, next) {
    try {
      const userId = req.user._id;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res
          .status(400)
          .json({ success: false, message: "داده‌ی نامعتبر" });
      }

      const basket = await basketModel.findOne({
        user: userId,
        status: "active",
      });
      if (!basket) {
        return res
          .status(404)
          .json({ success: false, message: "سبد خرید یافت نشد" });
      }

      // برای چک موجودی، محصولات مرتبط را یکجا می‌خوانیم
      const productIds = items
        .map((i) => i.productId)
        .filter((id) => mongoose.Types.ObjectId.isValid(id));

      const products = await productModel.find(
        { _id: { $in: productIds } },
        "quantity isActive",
      );
      const productMap = {};
      products.forEach((p) => (productMap[p._id.toString()] = p));

      // اعمال تغییرات روی آیتم‌های سبد
      for (const it of items) {
        const qty = Number(it.quantity);
        const idx = basket.items.findIndex(
          (bi) => bi.product.toString() === String(it.productId),
        );
        if (idx === -1) continue; // آیتمی که در سبد نیست را نادیده بگیر

        // تعداد ۰ یا کمتر = حذف
        if (!Number.isInteger(qty) || qty <= 0) {
          basket.items.splice(idx, 1);
          continue;
        }

        // چک موجودی
        const product = productMap[String(it.productId)];
        if (!product || !product.isActive) {
          basket.items.splice(idx, 1); // محصول حذف/غیرفعال شده
          continue;
        }
        const finalQty = qty > product.quantity ? product.quantity : qty;
        basket.items[idx].quantity = finalQty;
      }

      await basket.save();

      const totalItems = basket.items.reduce((s, i) => s + i.quantity, 0);

      return res.json({
        success: true,
        message: "سبد بروزرسانی شد",
        totalItems,
        totalPrice: basket.totalPrice,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new basketController();
