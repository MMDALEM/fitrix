const productModel = require("../../../models/product.model");
const { getExchangeRate } = require("../../../services/exchangeRate.service");
const controller = require("../../.controller");
const categoriesModel = require("../../../models/categories.model");
const brandModel = require("../../../models/brand.model");
const fs = require("fs");

class productController extends controller {
  async product(req, res, next) {
    try {
      const categories = await categoriesModel.find().lean();
      const brands = await brandModel.find().lean();

      return res.render("admin/product", {
        categories,
        brands,
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const {
        title,
        quantity,
        category,
        brand,
        originalPrice,
        ingredients,
        usage,
        howToUse,
        flavor,
        weight,
        description,
        type,
        servings,
        highNumber,
        single,
      } = req.body;

      if (!req.file) {
        const categories = await categoriesModel.find().lean();
        const brands = await brandModel.find().lean();
        return res.render("admin/product", {
          layout: "admin/layout",
          pageTitle: "محصول جدید",
          currentPage: "products",
          categories,
          brands,
          error: "آپلود تصویر محصول الزامی است",
        });
      }

      const slug = this.slugify(title);

      const { priceSingle, priceHigh, aedRate } = await this.convertToIRR(
        Number(originalPrice),
        Number(highNumber),
        Number(single),
      );

      const image = `/uploads/files/product/${req.file.filename}`;

      // validation
      const missing = [];

      if (!title) missing.push("نام محصول");
      if (!description) missing.push("توضیحات");
      if (!category) missing.push("دسته‌بندی");
      if (!brand) missing.push("برند");
      if (!originalPrice) missing.push("قیمت اصلی (درهم)");
      if (!quantity) missing.push("موجودی");
      if (!highNumber) missing.push("درصد سود عمده");
      if (!single) missing.push("درصد سود تکی");

      if (missing.length > 0) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return this.alertAndBack(req, res, {
          title: `لطفاً موارد زیر را تکمیل کنید:\n${missing.join(" | ")}`,
          icon: "error",
        });
      }

      await productModel.create({
        title,
        slug,
        image,
        category,
        brand,
        originalPrice: Number(originalPrice),
        quantity: Number(quantity),
        description,
        servings,
        flavor,
        darsad: {
          highNumber: Number(highNumber),
          single: Number(single),
        },
        ingredients,
        usage,
        howToUse,
        weight,
        priceSingle,
        priceHigh,
        AED: aedRate,
        type,
      });

      return this.alertAndBack(req, res, {
        title: "محصول با موفقیت ایجاد شد",
        icon: "success",
      });
    } catch (err) {
      if (err.code == 11000) {
        fs.unlink(req.file.path, () => {});
        return this.alertAndBack(req, res, {
          title: "چنین محصولی ای از قبل وجود دارد لطفا نام محصول را تغییر دهید",
          icon: "error",
        });
      }
      if (req.file) fs.unlink(req.file.path, () => {});
      return this.alertAndBack(req, res, {
        title: "خطا در ذخیره محصول",
        icon: "error",
      });
    }
  }

  async convertToIRR(originalPrice, highNumber, single) {
    const aedRate = await getExchangeRate();
    if (!aedRate) throw new Error("نرخ ارز موجود نیست");

    const base = originalPrice * aedRate;

    const priceSingle = Math.ceil((base * (1 + single / 100)) / 10000) * 10000;

    const priceHigh =
      Math.ceil((base * (1 + highNumber / 100)) / 10000) * 10000;

    return { priceSingle, priceHigh, aedRate };
  }
}

module.exports = new productController();
