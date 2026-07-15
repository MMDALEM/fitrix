const ExchangeRate = require("../models/exchangeRate.model");

const NAVASAN_API_KEY = process.env.NAVASAN_API_KEY;

// هسته‌ی به‌روزرسانی نرخ درهم از navasan (بدون req/res) — هم در کرون/بوت و هم
// در دکمه‌ی دستیِ ادمین استفاده می‌شود. نرخ را می‌گیرد، در دیتابیس ذخیره و
// همان مقدار را برمی‌گرداند.
async function refreshExchangeRate() {
  if (!NAVASAN_API_KEY) throw new Error("NAVASAN_API_KEY تنظیم نشده است");
  const response = await fetch(
    `https://api.navasan.tech/latest/?api_key=${NAVASAN_API_KEY}`,
  );
  if (!response.ok) throw new Error(`navasan status ${response.status}`);

  const json = await response.json();
  const rateInRials = Number(json?.aed?.value);
  if (!Number.isFinite(rateInRials) || rateInRials <= 0) {
    throw new Error("پاسخ نامعتبر از navasan");
  }

  await ExchangeRate.findOneAndUpdate(
    { currency: "AED" },
    { rateInRials, rateInToman: rateInRials, updatedAt: new Date() },
  );
  return rateInRials;
}

// نسخه‌ی HTTP برای دکمه‌ی «به‌روزرسانی نرخ» در پنل ادمین
async function updateExchangeRateNavasan(req, res, next) {
  try {
    const rateInRials = await refreshExchangeRate();
    req.flash("sweetalert", {
      title: `قیمت درهم بروز شد ریال: ${rateInRials}`,
      icon: "info",
      timer: 5500,
    });
    return res.redirect(req.header("Referer") || "/");
  } catch (error) {
    next(new Error("خطا در آپدیت نرخ ارز"));
  }
}

async function getExchangeRate() {
  const rate = await ExchangeRate.findOne({ currency: "AED" });
  return rate?.rateInToman || null;
}

module.exports = {
  refreshExchangeRate,
  updateExchangeRateNavasan,
  getExchangeRate,
};
