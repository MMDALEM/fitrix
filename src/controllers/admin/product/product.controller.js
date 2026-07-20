const productModel = require("../../../models/product.model");
const { getExchangeRate } = require("../../../services/exchangeRate.service");
const controller = require("../../.controller");
const categoriesModel = require("../../../models/categories.model");
const brandModel = require("../../../models/brand.model");
const ExchangeRate = require("../../../models/exchangeRate.model");
const moment = require("moment-jalaali");
const mongoose = require("mongoose");
const fs = require("fs");
const { notifyTorob } = require("../../../services/torob.service");

// آدرسِ مطلقِ صفحه‌ی محصول برای وبهوکِ ترب.
// اولویت با SITE_URL؛ اگر نبود از هاستِ همین درخواست ساخته می‌شود.
function productPageUrl(req, slug) {
  const base = String(
    process.env.SITE_URL || `${req.protocol}://${req.get("host")}`,
  ).replace(/\/+$/, "");
  return `${base}/product/${slug}`;
}

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

  // صفحه‌ی مدیریت «فروش شگفت‌انگیز» — انتخاب محصولات اسلایدر صفحه اصلی
  async amazingPage(req, res, next) {
    try {
      const products = await productModel
        .find({})
        .populate("brand", "title")
        .sort({ amazing: -1, onSale: -1, updatedAt: -1 })
        .lean();

      return res.render("admin/product/amazing", { products });
    } catch (err) {
      next(err);
    }
  }

  // فعال/غیرفعال کردن نمایش یک محصول در فروش شگفت‌انگیز
  async toggleAmazing(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return this.alertAndBack(req, res, {
          title: "شناسه محصول معتبر نیست",
          icon: "error",
        });
      }

      const product = await productModel.findById(id);
      if (!product) {
        return this.alertAndBack(req, res, {
          title: "محصول یافت نشد",
          icon: "error",
        });
      }

      product.amazing = !product.amazing;
      await product.save();

      return this.alertAndBack(req, res, {
        title: product.amazing
          ? `«${product.title}» به فروش شگفت‌انگیز اضافه شد`
          : `«${product.title}» از فروش شگفت‌انگیز حذف شد`,
        icon: "success",
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
        single, // فقط درصد تکی از فرم می‌آید
        salePercent, // درصد تخفیف خود محصول (اختیاری)
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

      // validation
      const missing = [];
      if (!title) missing.push("نام محصول");
      if (!description) missing.push("توضیحات");
      if (!category) missing.push("دسته‌بندی");
      if (!brand) missing.push("برند");
      if (!originalPrice) missing.push("قیمت اصلی (درهم)");
      if (!quantity) missing.push("موجودی");
      if (!single) missing.push("درصد سود تکی");

      if (missing.length > 0) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return this.alertAndBack(req, res, {
          title: `لطفاً موارد زیر را تکمیل کنید:\n${missing.join(" | ")}`,
          icon: "error",
        });
      }

      const slug = this.slugify(title);

      const {
        priceSingle,
        priceHigh5,
        priceHigh10,
        priceHigh15,
        priceHigh20,
        aedRate,
      } = await this.convertToIRR(Number(originalPrice), Number(single));

      const image = `/uploads/files/product/${req.file.filename}`;

      const sale = this.calcSale(priceSingle, salePercent);

      const createdProduct = await productModel.create({
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
          single: Number(single),
          // عمده‌ها (highNumber5/10/15/20) از دیفالت مدل پر می‌شوند
        },
        ingredients,
        usage,
        howToUse,
        weight,
        priceSingle,
        priceHigh5,
        priceHigh10,
        priceHigh15,
        priceHigh20,
        salePercent: sale.percent,
        salePrice: sale.price,
        onSale: sale.on,
        siteHidden:
          req.body.siteHidden === "on" || req.body.siteHidden === "true",
        AED: aedRate,
        type,
      });

      // اطلاع به ترب برای همگام‌سازیِ سریع‌تر (فقط اگر محصول در سایت دیده می‌شود).
      // fire-and-forget: خطا/کندیِ ترب نباید ذخیره‌ی محصول را تحت‌تأثیر بگذارد.
      if (createdProduct && !createdProduct.siteHidden) {
        notifyTorob([
          {
            page_url: productPageUrl(req, createdProduct.slug),
            page_unique: String(createdProduct._id),
          },
        ]);
      }

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
      require("../../../utils/logError").logError(err, {
        source: "product-create",
        req,
      });
      return this.alertAndBack(req, res, {
        title: err.userSafe ? err.message : "خطا در ذخیره محصول",
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
        single,
        salePercent,
      } = req.body;

      const missing = [];
      if (!title) missing.push("نام محصول");
      if (!description) missing.push("توضیحات");
      if (!category) missing.push("دسته‌بندی");
      if (!brand) missing.push("برند");
      if (!originalPrice) missing.push("قیمت اصلی (درهم)");
      if (!quantity) missing.push("موجودی");
      if (!single) missing.push("درصد سود تکی");

      if (missing.length > 0) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return this.alertAndBack(req, res, {
          title: `لطفاً موارد زیر را تکمیل کنید:\n${missing.join(" | ")}`,
          icon: "error",
        });
      }

      const objectId = mongoose.Types.ObjectId.createFromHexString(id);
      const product = await productModel.findById(objectId);
      if (!product) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return this.alertAndBack(req, res, {
          title: "محصول یافت نشد",
          icon: "error",
        });
      }

      // محاسبه‌ی قیمت‌ها از روی درهم خام (همان منطق ساخت محصول)
      // نرخِ ذخیره‌شده‌ی همین محصول (product.AED) به‌عنوان fallback پاس داده
      // می‌شود تا اگر نرخ زنده در دسترس نبود، ویرایش شکست نخورد.
      const {
        priceSingle,
        priceHigh5,
        priceHigh10,
        priceHigh15,
        priceHigh20,
        aedRate,
      } = await this.convertToIRR(
        Number(originalPrice),
        Number(single),
        product.AED,
      );

      const sale = this.calcSale(priceSingle, salePercent);

      const updateData = {
        title,
        slug: this.slugify(title),
        category,
        brand,
        originalPrice: Number(originalPrice),
        quantity: Number(quantity),
        description,
        servings,
        flavor,
        darsad: {
          single: Number(single),
          highNumber5: 5,
          highNumber10: 10,
          highNumber15: 15,
          highNumber20: 20,
        },
        ingredients,
        usage,
        howToUse,
        weight,
        priceSingle,
        priceHigh5,
        priceHigh10,
        priceHigh15,
        priceHigh20,
        salePercent: sale.percent,
        salePrice: sale.price,
        onSale: sale.on,
        siteHidden:
          req.body.siteHidden === "on" || req.body.siteHidden === "true",
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

      await productModel.findByIdAndUpdate(objectId, updateData, {
        runValidators: true,
      });

      // اطلاع به ترب از تغییرِ محصول (fire-and-forget). محصولاتِ مخفیِ سایت
      // به ترب داده نمی‌شوند، پس برایشان وبهوک هم نمی‌فرستیم.
      if (!updateData.siteHidden) {
        notifyTorob([
          {
            page_url: productPageUrl(req, updateData.slug),
            page_unique: String(id),
          },
        ]);
      }

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
      require("../../../utils/logError").logError(err, {
        source: "product-edit",
        req,
      });
      return this.alertAndBack(req, res, {
        title: err.userSafe ? err.message : "خطا در ویرایش محصول",
        icon: "error",
      });
    }
  }

  // محاسبه‌ی قیمت تخفیف‌خورده‌ی محصول از روی قیمت تکی و درصد تخفیف
  // گرد کردن به نزدیک‌ترین ۱۰۰۰ تومان
  calcSale(priceSingle, salePercent) {
    let percent = Number(salePercent);
    if (!Number.isFinite(percent) || percent < 0) percent = 0;
    if (percent > 100) percent = 100;

    if (percent === 0) {
      return { percent: 0, price: null, on: false };
    }

    const price =
      Math.round((priceSingle * (1 - percent / 100)) / 1000) * 1000;
    return { percent, price, on: true };
  }

  async convertToIRR(originalPrice, single, fallbackAED = null) {
    // نرخ زنده‌ی درهم؛ اگر موجود نبود (سرویس نرخ خاموش/تنظیم‌نشده) و نرخِ
    // ذخیره‌شده‌ی خودِ محصول در دست بود، از آن استفاده می‌کنیم تا ویرایش
    // به‌خاطر نبودِ لحظه‌ایِ نرخ کاملاً شکست نخورد.
    let aedRate = await getExchangeRate();
    if (!aedRate) aedRate = Number(fallbackAED) || 0;
    if (!aedRate) {
      const e = new Error(
        "نرخ درهم تنظیم نشده است. ابتدا از پنل، «به‌روزرسانی قیمت‌ها» را بزنید یا نرخ درهم را ثبت کنید.",
      );
      e.userSafe = true;
      throw e;
    }

    const base = originalPrice * aedRate;

    // اعمال درصد + گرد کردن به بالا به نزدیک‌ترین ۱۰۰۰۰
    const calc = (percent) =>
      Math.ceil((base * (1 + percent / 100)) / 10000) * 10000;

    return {
      priceSingle: calc(single),
      priceHigh5: calc(5),
      priceHigh10: calc(10),
      priceHigh15: calc(15),
      priceHigh20: calc(20),
      aedRate,
    };
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

      const products = await productModel.find(
        {},
        "originalPrice darsad salePercent",
      );

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
        const salePercent = product.salePercent || 0; // درصد تخفیف خود محصول

        const base = originalPrice * aedRate; // پایه به تومان

        // اعمال درصد + گرد کردن به بالا به نزدیک‌ترین ۱۰۰۰۰
        const calc = (percent) =>
          Math.ceil((base * (1 + percent / 100)) / 10000) * 10000;

        // بازمحاسبه‌ی قیمت تخفیف‌خورده با قیمت تکی جدید
        const newPriceSingle = calc(single);
        const salePrice =
          salePercent > 0
            ? Math.round((newPriceSingle * (1 - salePercent / 100)) / 1000) *
              1000
            : null;

        return {
          updateOne: {
            filter: { _id: product._id },
            update: {
              $set: {
                priceSingle: newPriceSingle,
                salePrice,
                onSale: salePercent > 0,
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
