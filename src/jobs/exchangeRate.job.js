const cron = require('node-cron');
const { updateExchangeRate } = require('../services/exchangeRate.service');

function startExchangeRateCron() {
  // صبح ساعت 8
  cron.schedule('0 8 * * *', () => {
    console.log('🕐 آپدیت صبح...');
    updateExchangeRate();
  });

  // ظهر ساعت 13
  cron.schedule('0 13 * * *', () => {
    console.log('🕐 آپدیت ظهر...');
    updateExchangeRate();
  });

  // شب ساعت 20
  cron.schedule('0 20 * * *', () => {
    console.log('🕐 آپدیت شب...');
    updateExchangeRate();
  });

  console.log('✅ Cron job نرخ ارز فعال شد');
}

module.exports = { startExchangeRateCron };