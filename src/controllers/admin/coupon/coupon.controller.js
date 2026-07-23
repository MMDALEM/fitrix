// ───────────────────────────────────────────────────────────────
// مدیریتِ «کدِ تخفیف» (Coupon) — جدا از تخفیفِ درصدیِ تکِ محصولات.
// یک کد می‌تواند سه دامنه داشته باشد:
//   • all      → روی همه‌ی محصولات
//   • product  → فقط محصولات انتخاب‌شده
//   • category → فقط دسته‌بندی‌های انتخاب‌شده
// تخفیف هنگام پرداخت فقط روی «اقلامِ مشمول» حساب می‌شود.
// ───────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const discountModel = require("../../../models/discount.model");
const productModel = require("../../../models/product.model");
const categoriesModel = require("../../../models/categories.model");
const controller = require("../../.controller");

function toDateInput(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  return dt.toISOString().slice(0, 10);
}

// دامنه‌ی کد بر اساس فیلدهای پرشده
function scopeOf(doc) {
  if (doc.products && doc.products.length) return "product";
  if (doc.categories && doc.categories.length) return "category";
  return "all";
}

class couponController extends controller {
  async index(req, res, next) {
    try {
      const [coupons, products, categories] = await Promise.all([
        discountModel.find({}).sort({ createdAt: -1 }).lean(),
        productModel.find({}, "title").sort({ title: 1 }).lean(),
        categoriesModel.find({}, "title").sort({ title: 1 }).lean(),
      ]);

      coupons.forEach((c) => {
        c._scope = scopeOf(c);
        c._startInput = toDateInput(c.startDate);
        c._endInput = toDateInput(c.endDate);
        c._productIds = (c.products || []).map((id) => String(id));
        c._categoryIds = (c.categories || []).map((id) => String(id));
      });

      return res.render("admin/coupon/index", {
        coupons,
        products,
        categories,
      });
    } catch (err) {
      next(err);
    }
  }

  // ساخت یا ویرایش کد تخفیف
  async save(req, res, next) {
    try {
      const {
        id,
        title,
        code,
        discountType,
        value,
        scope,
        products,
        categories,
        minPurchaseAmount,
        maxDiscountAmount,
        startDate,
        endDate,
        maxUsage,
        maxUsagePerUser,
        isActive,
      } = req.body;

      if (!title || !code)
        return this.alertAndBack(req, res, {
          title: "عنوان و کد تخفیف الزامی است",
          icon: "error",
        });

      const type = discountType === "fixed" ? "fixed" : "percentage";
      const val = Number(value);
      if (!Number.isFinite(val) || val <= 0)
        return this.alertAndBack(req, res, {
          title: "مقدار تخفیف نامعتبر است",
          icon: "error",
        });
      if (type === "percentage" && val > 100)
        return this.alertAndBack(req, res, {
          title: "درصد تخفیف نباید بیشتر از ۱۰۰ باشد",
          icon: "error",
        });

      // تاریخ‌ها
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : null;
      if (!end || isNaN(end))
        return this.alertAndBack(req, res, {
          title: "تاریخ پایان الزامی و معتبر باید باشد",
          icon: "error",
        });
      end.setHours(23, 59, 59, 999);
      if (end < start)
        return this.alertAndBack(req, res, {
          title: "تاریخ پایان نباید قبل از تاریخ شروع باشد",
          icon: "error",
        });

      // دامنه‌ی اعمال
      const toIdArray = (v) =>
        (Array.isArray(v) ? v : v ? [v] : []).filter((x) =>
          mongoose.Types.ObjectId.isValid(x),
        );
      let productIds = [];
      let categoryIds = [];
      if (scope === "product") {
        productIds = toIdArray(products);
        if (!productIds.length)
          return this.alertAndBack(req, res, {
            title: "برای دامنه‌ی «محصول»، حداقل یک محصول انتخاب کنید",
            icon: "error",
          });
      } else if (scope === "category") {
        categoryIds = toIdArray(categories);
        if (!categoryIds.length)
          return this.alertAndBack(req, res, {
            title: "برای دامنه‌ی «دسته‌بندی»، حداقل یک دسته انتخاب کنید",
            icon: "error",
          });
      }
      // scope === "all" → هر دو خالی

      const data = {
        title: String(title).trim().slice(0, 100),
        code: String(code).trim().toUpperCase().slice(0, 50),
        discountType: type,
        value: val,
        products: productIds,
        categories: categoryIds,
        minPurchaseAmount: Math.max(Number(minPurchaseAmount) || 0, 0),
        maxDiscountAmount:
          maxDiscountAmount && Number(maxDiscountAmount) > 0
            ? Number(maxDiscountAmount)
            : null,
        startDate: start,
        endDate: end,
        maxUsage: maxUsage && Number(maxUsage) > 0 ? Number(maxUsage) : null,
        maxUsagePerUser: Math.max(Number(maxUsagePerUser) || 1, 1),
        isActive: isActive === "on" || isActive === "true" || isActive === true,
      };

      if (id && mongoose.Types.ObjectId.isValid(id)) {
        // ویرایش — usedCount و usageHistory دست‌نخورده می‌مانند
        await discountModel.updateOne({ _id: id }, { $set: data });
        return this.alertAndBack(req, res, {
          title: "کد تخفیف ویرایش شد",
          icon: "success",
        });
      }

      await discountModel.create(data);
      return this.alertAndBack(req, res, {
        title: "کد تخفیف ساخته شد",
        icon: "success",
      });
    } catch (err) {
      console.log(err);
      if (err.code === 11000)
        return this.alertAndBack(req, res, {
          title: "این کد تخفیف قبلاً وجود دارد؛ کد دیگری انتخاب کنید",
          icon: "error",
        });
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return this.alertAndBack(req, res, {
          title: "شناسه نامعتبر است",
          icon: "error",
        });
      await discountModel.deleteOne({ _id: id });
      return this.alertAndBack(req, res, {
        title: "کد تخفیف حذف شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  // فعال/غیرفعال کردن سریع
  async toggle(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return this.alertAndBack(req, res, {
          title: "شناسه نامعتبر است",
          icon: "error",
        });
      const c = await discountModel.findById(id);
      if (!c)
        return this.alertAndBack(req, res, {
          title: "کد یافت نشد",
          icon: "error",
        });
      c.isActive = !c.isActive;
      await c.save();
      return this.alertAndBack(req, res, {
        title: c.isActive ? "کد فعال شد" : "کد غیرفعال شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new couponController();
