const exchangeRateModel = require("../../models/exchangeRate.model");
const basketModel = require("../../models/basket.model");
const productModel = require("../../models/product.model");
const userModel = require("../../models/user.model");
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

      return res.render("admin", { users, products, orders, ExchangeRates });
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

      let title = `قیمت همه محصولات بروزرسانی شد با درهم: ${aedRate} , کل محصولات : بروزرسانی شده : ${result.modifiedCount}`,
        icon = "info",
        timer = 9500;
      req.flash("sweetalert", { title, icon, timer });
      return res.redirect(req.header("Referer") || "/");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new adminController();
