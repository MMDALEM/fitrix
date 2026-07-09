const cron = require("node-cron");
const { refreshExchangeRate } = require("../services/exchangeRate.service");

// به‌روزرسانیِ امن: خطای سرویسِ بیرونی هرگز نباید کرون/اپ را بشکند
async function safeRefresh(label) {
  try {
    const rate = await refreshExchangeRate();
    console.log(`✅ نرخ ارز به‌روزرسانی شد (${label}): ${rate}`);
  } catch (e) {
    console.error(`⚠️ خطا در به‌روزرسانی نرخ ارز (${label}):`, e.message);
  }
}

function startExchangeRateCron() {
  cron.schedule("0 8 * * *", () => safeRefresh("صبح")); // صبح ۸
  cron.schedule("0 13 * * *", () => safeRefresh("ظهر")); // ظهر ۱۳
  cron.schedule("0 20 * * *", () => safeRefresh("شب")); // شب ۲۰
  console.log("✅ Cron job نرخ ارز فعال شد");
}

module.exports = { startExchangeRateCron };
