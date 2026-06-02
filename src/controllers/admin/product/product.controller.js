const productModel = require("../../../models/product.model");
const { getExchangeRate } = require("../../../services/exchangeRate.service");
const controller = require("../../.controller");
const categoriesModel = require("../../../models/categories.model");
const brandModel = require("../../../models/brand.model");
const ExchangeRate = require("../../../models/exchangeRate.model");
const moment = require("moment-jalaali");
const mongoose = require("mongoose");
const fs = require("fs");

class productController extends controller {
  async products(req, res, next) {
    try {
      const { page = 1, limit = 100 } = req.query;

      const productsss = await productModel.paginate({
        page: Number(page),
        limit: Number(limit),
        sort: "createdAt: -1",
        populate: ["category", "brand"],
      });

      const products = await productModel
        .find({})
        .populate("category")
        .populate("brand");

      return res.render("admin/product", {
        products,
      });
    } catch (err) {
      next(err);
    }
  }

  async createPage(req, res, next) {
    try {
      const categories = await categoriesModel.find().lean();
      const brands = await brandModel.find().lean();

      return res.render("admin/product/create", {
        categories,
        brands,
      });
    } catch (err) {
      next(err);
    }
  }

  async productPagePDF(req, res, next) {
    try {
      // گرفتن دسته‌بندی‌های فعال به ترتیب نمایش
      const categories = await categoriesModel
        .find({ isActive: true })
        .sort({ level: 1, title: 1 })
        .lean();

      // گرفتن برندهای فعال
      const brands = await brandModel
        .find({ isActive: true })
        .sort({ displayOrder: 1, title: 1 })
        .lean();

      // گرفتن همه محصولات با populate دسته‌بندی و برند
      const products = await productModel
        .find({})
        .populate("category", "_id title")
        .populate("brand", "_id title")
        .sort({ createdAt: -1 })
        .lean();

      return res.render("admin/pdf", {
        categories,
        brands,
        products,
        query: req.query,
        catalogDate: moment().format("jYYYY/jMM/jDD"),
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

  async editPage(req, res, next) {
    try {
      const product = await productModel.findById(req.params.id);
      if (!product)
        return this.alertAndBack(req, res, {
          title: "محصول یافت نشد",
          icon: "error",
        });

      const categories = await categoriesModel.find();
      const brands = await brandModel.find();
      return res.render("admin/product/edit", { categories, brands, product });
    } catch (err) {
      next(err);
    }
  }

  async edit(req, res, next) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return this.alertAndBack(req, res, {
          title: "شناسه محصول معتبر نیست",
          icon: "error",
        });
      }

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

      const product = await productModel.findById(id);
      if (!product) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return this.alertAndBack(req, res, {
          title: "محصول یافت نشد",
          icon: "error",
        });
      }

      // محاسبه‌ی قیمت‌ها از روی درهم خام (همان منطق ساخت محصول)
      const { priceSingle, priceHigh, aedRate } = await this.convertToIRR(
        Number(originalPrice),
        Number(highNumber),
        Number(single),
      );

      // فیلدهای قابل آپدیت
      const updateData = {
        title,
        slug: this.slugify(title),
        category: category,
        brand: brand,
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
      };

      if (req.file) {
        if (product.image) {
          const oldPath = `public${product.image}`;
          fs.unlink(oldPath, () => {});
        }
        updateData.image = `/uploads/files/product/${req.file.filename}`;
      }

      await productModel.findByIdAndUpdate(id, updateData, {
        runValidators: true,
      });

      return this.alertAndReview(
        req,
        res,
        {
          title: "محصول با موفقیت ویرایش شد",
          icon: "success",
        },
        "/admin/product",
      );
    } catch (err) {
      if (err.code == 11000) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return this.alertAndBack(req, res, {
          title: "محصولی با این نام از قبل وجود دارد، لطفاً نام را تغییر دهید",
          icon: "error",
        });
      }
      if (req.file) fs.unlink(req.file.path, () => {});
      return this.alertAndBack(req, res, {
        title: "خطا در ویرایش محصول",
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

  async updateAllPrices(req, res, next) {
    try {
      // نرخ روز درهم — همان منبعی که هنگام ساخت/ویرایش محصول استفاده می‌شود
      const aedRate = await getExchangeRate();
      if (!aedRate) {
        return res.status(400).json({
          success: false,
          message: "نرخ ارز موجود نیست",
        });
      }

      // درصدهای عمده‌ی ثابت — اگر خواستی عوض کنی فقط همین‌جا تغییر بده
      const HIGH = [5, 10, 15, 20];

      const products = await productModel.find({}, "originalPrice darsad");

      if (products.length === 0) {
        return res.json({
          success: true,
          message: "محصولی برای بروزرسانی وجود ندارد",
          updated: 0,
        });
      }

      const operations = products.map((product) => {
        const originalPrice = product.originalPrice || 0; // درهم خام (دست نمی‌خورد)
        const single = product.darsad?.single ?? 0; // درصد تکی فعلی محصول

        const base = originalPrice * aedRate; // پایه به تومان

        // اعمال درصد + گرد کردن به بالا به نزدیک‌ترین ۱۰۰۰۰
        const calc = (percent) =>
          Math.ceil((base * (1 + percent / 100)) / 10000) * 10000;

        return {
          updateOne: {
            filter: { _id: product._id },
            update: {
              $set: {
                priceSingle: calc(single),
                priceHigh5: calc(HIGH[0]),
                priceHigh10: calc(HIGH[1]),
                priceHigh15: calc(HIGH[2]),
                priceHigh20: calc(HIGH[3]),
                AED: aedRate, // نرخ لحظه‌ی درهم
                // اطمینان از وجود درصدهای عمده در darsad
                "darsad.single": single,
                "darsad.highNumber5": HIGH[0],
                "darsad.highNumber10": HIGH[1],
                "darsad.highNumber15": HIGH[2],
                "darsad.highNumber20": HIGH[3],
              },
              // حذف فیلدهای قدیمی اگر وجود داشتند
              $unset: {
                priceHigh: "",
                "darsad.highNumber": "",
              },
            },
          },
        };
      });

      const result = await productModel.bulkWrite(operations);

      return res.json({
        success: true,
        message: "قیمت همه محصولات بروزرسانی شد",
        aedRate,
        matched: result.matchedCount,
        modified: result.modifiedCount,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new productController();
