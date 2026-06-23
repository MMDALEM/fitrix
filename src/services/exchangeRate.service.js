const ExchangeRate = require("../models/exchangeRate.model");

const NERKH_API_KEY = process.env.NERKH_API_KEY;
const NAVASAN_API_KEY = process.env.NAVASAN_API_KEY;

async function saveRateAndRespond(req, res, rateInRials) {
  const rateInToman = rateInRials;
  await ExchangeRate.findOneAndUpdate(
    { currency: "AED" },
    { rateInRials, rateInToman, updatedAt: new Date() },
  );
  let title = `قیمت درهم بروز شد ریال: ${rateInRials}`,
    icon = "info",
    timer = 5500;
  req.flash("sweetalert", { title, icon, timer });
  return res.redirect(req.header("Referer") || "/");
}

async function updateExchangeRate(req, res, next) {
  try {
    const response = await fetch(
      `https://nerkh-api.ir/api/${NERKH_API_KEY}/currency/?filter=AED`,
    );
    if (!response.ok) throw new Error(`nerkh-api status ${response.status}`);

    const json = await response.json();
    const rateInRials = Number(json?.data?.prices?.AED?.current);
    if (!Number.isFinite(rateInRials) || rateInRials <= 0) {
      throw new Error("پاسخ نامعتبر از nerkh-api: " + JSON.stringify(json));
    }
    return await saveRateAndRespond(req, res, rateInRials);
  } catch (error) {
    next(new Error("خطا در آپدیت نرخ ارز"));
  }
}

async function updateExchangeRateNavasan(req, res, next) {
  try {
    const response = await fetch(
      `https://api.navasan.tech/latest/?api_key=${NAVASAN_API_KEY}`,
    );
    if (!response.ok) throw new Error(`navasan status ${response.status}`);

    const json = await response.json();
    const rateInRials = Number(json?.aed?.value);

    if (!Number.isFinite(rateInRials) || rateInRials <= 0)
      throw new Error("پاسخ نامعتبر از navasan: " + JSON.stringify(json));

    return await saveRateAndRespond(req, res, rateInRials);
  } catch (error) {
    next(new Error("خطا در آپدیت نرخ ارز"));
  }
}

async function getExchangeRate() {
  const rate = await ExchangeRate.findOne({ currency: "AED" });
  return rate?.rateInToman || null;
}

module.exports = {
  updateExchangeRate,
  updateExchangeRateNavasan,
  getExchangeRate,
};
