const JWT = require("jsonwebtoken");
const userModel = require("../models/user.model");
const categoriesModel = require("../models/categories.model");
const basketModel = require("../models/basket.model");
const addressModel = require("../models/address.model");

class GlobalData {
  static async auth(req, res, next) {
    try {
      // اکسس‌توکن، و در صورت انقضا رفرش‌توکن (تمدید بی‌صدا) —
      // کاربر هنگام بازگشت از درگاه پرداخت هم لاگین می‌ماند
      const { resolveUser } = require("./auth.middleware");
      const user = await resolveUser(req, res);

      if (user) {
        req.user = user;
        res.locals.user = user;
        res.locals.addresses = await addressModel.find({ user: user._id });
      } else {
        req.user = null;
        res.locals.user = null;
      }
    } catch {
      req.user = null;
      res.locals.user = null;
    }
    next();
  }

  static async categories(req, res, next) {
    try {
      // فقط دسته‌های اصلی؛ زیر‌دسته‌های فعال داخل subCategories می‌آیند
      // (قبلاً همه‌ی دسته‌ها flat برمی‌گشتند و زیر‌دسته‌ها در منو تکرار می‌شدند)
      res.locals.categories = await categoriesModel
        .find({ isActive: true, parent: null })
        .sort({ displayOrder: 1, title: 1 })
        .populate({
          path: "subCategories",
          match: { isActive: true },
          options: { sort: { title: 1 } },
        });
    } catch {
      res.locals.categories = [];
    }
    next();
  }

  static async settings(req, res, next) {
    const base = {
      siteName: "فیت ریکس شاپ",
      siteNameEn: "FitRix",
      logo: "/images/logo.png",
      phone: "09373640517",
      email: "info@fitrix.ir",
      taxEnabled: true,
      taxRate: 0.1,
    };
    try {
      const settingModel = require("../models/setting.model");
      const s = await settingModel.getSingleton();
      base.taxEnabled = s.taxEnabled;
      base.taxRate = s.taxRate;
    } catch {
      // در صورت خطا، مقادیر پیش‌فرض باقی می‌مانند
    }
    res.locals.settings = base;
    next();
  }

  // مقادیر پیش‌فرض SEO — هر کنترلر می‌تواند هنگام render بازنویسی‌شان کند
  static seo(req, res, next) {
    const siteUrl = `${req.protocol}://${req.get("host")}`;
    res.locals.siteUrl = siteUrl;
    res.locals.currentUrl = siteUrl + req.originalUrl;
    // canonical پیش‌فرض بدون query string؛ صفحاتی مثل فیلتر دسته‌بندی بازنویسی می‌کنند
    res.locals.canonicalUrl = siteUrl + req.path;
    res.locals.pageTitle = null;
    res.locals.metaDescription =
      "فروشگاه اینترنتی فیت ریکس (FitRix | fitrix.ir)؛ خرید انواع مکمل ورزشی، پروتئین وی، کراتین، گینر و ویتامین از برندهای معتبر جهانی با قیمت مناسب و ارسال سریع.";
    res.locals.ogImage = siteUrl + "/images/logo.png";
    res.locals.ogType = "website";
    res.locals.noindex = false;
    next();
  }

  static async setLocals(req, res, next) {
    try {
      const PRODUCT_SELECT = "title image slug priceSingle quantity";

      res.locals.user = req.user || null;

      if (req.user) {
        const basket = await basketModel
          .findOne({ user: req.user._id, status: "active" })
          .populate("items.product", PRODUCT_SELECT)
          .lean();

        res.locals.basket = basket || { items: [] };
      } else {
        res.locals.basket = { items: [] };
      }

      next();
    } catch (err) {
      require("../utils/logError").logError(err, { source: "globalData", req });
      res.locals.basket = { items: [] };
      next();
    }
  }

  static init() {
    return [this.auth, this.categories, this.settings, this.seo, this.setLocals];
  }
}

module.exports = GlobalData;
