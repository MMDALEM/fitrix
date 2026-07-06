const mongoose = require("mongoose");
const productModel = require("../../../models/product.model");
const controller = require("../../.controller");

// مدیریت تخفیف‌های محصولات به‌همراه بازه‌ی تاریخ (شروع/پایان)
class discountController extends controller {
  // وضعیت تخفیف یک محصول: فعال / زمان‌بندی‌شده / منقضی / بدون تخفیف
  saleStatus(p) {
    if (!p.onSale || !p.salePercent || p.salePercent <= 0)
      return { key: "none", label: "بدون تخفیف" };
    const now = new Date();
    if (p.saleStartDate && new Date(p.saleStartDate) > now)
      return { key: "scheduled", label: "زمان‌بندی‌شده" };
    if (p.saleEndDate && new Date(p.saleEndDate) < now)
      return { key: "expired", label: "منقضی" };
    return { key: "active", label: "فعال" };
  }

  // مقدار input[type=date] از یک تاریخ (YYYY-MM-DD) — برای پرکردن فرم
  toDateInput(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return "";
    return dt.toISOString().slice(0, 10);
  }

  async index(req, res, next) {
    try {
      const products = await productModel
        .find({})
        .populate("brand", "title")
        .sort({ onSale: -1, updatedAt: -1 })
        .lean();

      products.forEach((p) => {
        p._status = this.saleStatus(p);
        p._startInput = this.toDateInput(p.saleStartDate);
        p._endInput = this.toDateInput(p.saleEndDate);
      });

      // محصولاتی که تخفیف دارند بالای صفحه به‌صورت جدول نمایش داده می‌شوند
      const discounted = products.filter(
        (p) => p.onSale && p.salePercent > 0,
      );

      return res.render("admin/discount/index", {
        products,
        discounted,
      });
    } catch (err) {
      next(err);
    }
  }

  // ثبت/ویرایش تخفیف یک محصول (upsert بر اساس محصول انتخاب‌شده)
  async save(req, res, next) {
    try {
      const { productId, salePercent, startDate, endDate } = req.body;

      if (!productId || !mongoose.Types.ObjectId.isValid(productId))
        return this.alertAndBack(req, res, {
          title: "محصول را انتخاب کنید",
          icon: "error",
        });

      const percent = Number(salePercent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100)
        return this.alertAndBack(req, res, {
          title: "درصد تخفیف باید بین ۰ تا ۱۰۰ باشد",
          icon: "error",
        });

      const product = await productModel.findById(productId);
      if (!product)
        return this.alertAndBack(req, res, {
          title: "محصول یافت نشد",
          icon: "error",
        });

      // تاریخ‌ها (اختیاری) — بازه‌ی فعال بودن تخفیف
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && isNaN(start))
        return this.alertAndBack(req, res, {
          title: "تاریخ شروع معتبر نیست",
          icon: "error",
        });
      if (end && isNaN(end))
        return this.alertAndBack(req, res, {
          title: "تاریخ پایان معتبر نیست",
          icon: "error",
        });
      if (start && end && end < start)
        return this.alertAndBack(req, res, {
          title: "تاریخ پایان نباید قبل از تاریخ شروع باشد",
          icon: "error",
        });

      // پایان روز برای تاریخ پایان تا کل آن روز شامل تخفیف شود
      if (end) end.setHours(23, 59, 59, 999);

      if (percent === 0) {
        // درصد صفر = حذف تخفیف
        product.salePercent = 0;
        product.salePrice = null;
        product.onSale = false;
        product.saleStartDate = null;
        product.saleEndDate = null;
      } else {
        product.salePercent = percent;
        product.salePrice =
          Math.round((product.priceSingle * (1 - percent / 100)) / 1000) * 1000;
        product.onSale = true;
        product.saleStartDate = start;
        product.saleEndDate = end;
      }

      await product.save();

      return this.alertAndBack(req, res, {
        title: percent === 0 ? "تخفیف حذف شد" : "تخفیف ذخیره شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  // حذف تخفیف یک محصول
  async clear(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return this.alertAndBack(req, res, {
          title: "شناسه محصول معتبر نیست",
          icon: "error",
        });

      await productModel.findByIdAndUpdate(id, {
        $set: {
          salePercent: 0,
          salePrice: null,
          onSale: false,
          saleStartDate: null,
          saleEndDate: null,
        },
      });

      return this.alertAndBack(req, res, {
        title: "تخفیف محصول حذف شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new discountController();
