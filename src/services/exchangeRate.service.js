const ExchangeRate = require("../models/exchangeRate.model");
const api_key = process.env.AED_API_KEY;

async function updateExchangeRate(req, res, next) {
  try {
    const response = await fetch(
      `https://nerkh-api.ir/api/${api_key}/currency/?filter=AED`,
    );
    const json = await response.json();

    const rateInRials = Number(json.data.prices.AED.current);
    const rateInToman = rateInRials / 10;

    await ExchangeRate.findOneAndUpdate(
      { currency: "AED" },
      { rateInRials, rateInToman, updatedAt: new Date() },
      { upsert: true, new: true },
    );

    let title = `قیمت درهم بروز شد ریال: ${rateInRials}`,
      icon = "info",
      timer = 5500;
    req.flash("sweetalert", { title, icon, timer });
    return res.redirect(req.header("Referer") || "/");
  } catch (error) {
    console.error("خطا در بروزرسانی نرخ ارز:", error);
    next(new Error("خطا در آپدیت نرخ ارز"));
  }
}

async function getExchangeRate() {
  const rate = await ExchangeRate.findOne({ currency: "AED" });
  return rate?.rateInToman || null;
}

module.exports = { updateExchangeRate, getExchangeRate };
