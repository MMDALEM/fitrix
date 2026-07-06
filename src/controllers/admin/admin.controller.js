const mongoose = require("mongoose");
const exchangeRateModel = require("../../models/exchangeRate.model");
const basketModel = require("../../models/basket.model");
const productModel = require("../../models/product.model");
const userModel = require("../../models/user.model");
const settingModel = require("../../models/setting.model");
const notificationModel = require("../../models/notification.model");
const {
  updateExchangeRateNavasan,
  getExchangeRate,
} = require("../../services/exchangeRate.service");
const controller = require("../.controller");

class adminController extends controller {
  async admin(req, res, next) {
    try {
      const users = (await userModel.find().sort({})).length;
      const products = await productModel.find().sort({});
      // سفارش‌ها = سبدهای پرداخت‌شده
      const orders = await basketModel.countDocuments({ status: "paid" });
      const ExchangeRates = await exchangeRateModel.findOne({
        currency: "AED",
      });

      // اعلان‌های خرید برای نمایش روی داشبورد ادمین
      const notifications = await notificationModel
        .find({ audience: "admin" })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();
      const unreadCount = await notificationModel.countDocuments({
        audience: "admin",
        isRead: false,
      });

      // آخرین سفارش‌های پرداخت‌شده (واقعی) برای جدول داشبورد
      const recentOrders = await basketModel
        .find({ status: "paid" })
        .populate("items.product", "title image")
        .sort({ paidAt: -1 })
        .limit(6)
        .lean();

      return res.render("admin", {
        users,
        products,
        orders,
        ExchangeRates,
        notifications,
        unreadCount,
        recentOrders,
      });
    } catch (err) {
      next(err);
    }
  }

  async updated_AED(req, res, next) {
    try {
      return await updateExchangeRateNavasan(req, res, next);
    } catch (err) {
      next(err);
    }
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

      let title = `قیمت همه محصولات بروزرسانی شد با درهم: ${aedRate} , کل محصولات : بروزرسانی شده : ${result.modifiedCount}`,
        icon = "info",
        timer = 9500;
      req.flash("sweetalert", { title, icon, timer });
      return res.redirect(req.header("Referer") || "/");
    } catch (err) {
      next(err);
    }
  }

  // صفحه‌ی تنظیمات سایت (مالیات و ...)
  async settingsPage(req, res, next) {
    try {
      res.locals.layout = "admin/master";
      const settings = await settingModel.getSingleton();
      return res.render("admin/settings/index", { settings });
    } catch (err) {
      next(err);
    }
  }

  // روشن/خاموش کردن مالیات + تنظیم نرخ آن
  async updateTax(req, res, next) {
    try {
      const settings = await settingModel.getSingleton();

      // چک‌باکس فقط وقتی فرستاده می‌شود که تیک خورده باشد
      settings.taxEnabled = req.body.taxEnabled === "on" || req.body.taxEnabled === "true";

      // نرخ مالیات به‌صورت درصد از فرم می‌آید (مثلاً 10) → به کسر تبدیل می‌شود
      if (req.body.taxPercent !== undefined && req.body.taxPercent !== "") {
        const pct = Number(req.body.taxPercent);
        if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
          settings.taxRate = pct / 100;
        }
      }

      await settings.save();

      return this.alertAndBack(req, res, {
        title: settings.taxEnabled
          ? `مالیات فعال شد (${Math.round(settings.taxRate * 100)}٪)`
          : "مالیات خاموش شد؛ از این پس روی سفارش‌های جدید مالیات حساب نمی‌شود",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  // بک‌آپ کامل کل پایگاه داده — همه‌ی کالکشن‌ها با فرمت Extended JSON
  // (ObjectId ،Date و ... حفظ می‌شوند و برای بازگردانی قابل استفاده‌اند)
  async backupDatabase(req, res, next) {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        return res
          .status(500)
          .json({ success: false, message: "اتصال به پایگاه داده برقرار نیست" });
      }

      // سریال‌سازی با EJSON درایور مونگو؛ اگر در دسترس نبود JSON معمولی
      const EJSON =
        (mongoose.mongo && mongoose.mongo.BSON && mongoose.mongo.BSON.EJSON) ||
        null;
      const serialize = (value) =>
        EJSON
          ? EJSON.stringify(value, { relaxed: false })
          : JSON.stringify(value);

      const collections = await db.listCollections().toArray();

      const backup = {
        meta: {
          site: "fitrix",
          database: db.databaseName,
          createdAt: new Date().toISOString(),
          format: EJSON ? "mongodb-extended-json" : "json",
          collections: [],
        },
        data: {},
      };

      for (const coll of collections) {
        // کالکشن‌های سیستمی را رد کن
        if (coll.name.startsWith("system.")) continue;

        const docs = await db.collection(coll.name).find({}).toArray();
        backup.meta.collections.push({ name: coll.name, count: docs.length });
        // هر کالکشن جداگانه سریال می‌شود تا نوع داده‌ها (ObjectId/Date) حفظ شود
        backup.data[coll.name] = JSON.parse(serialize(docs));
      }

      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const filename = `fitrix-db-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      return res.send(JSON.stringify(backup, null, 2));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new adminController();
