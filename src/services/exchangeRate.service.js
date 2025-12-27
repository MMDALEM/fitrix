// services/exchangeRate.service.js
const ExchangeRate = require('../models/exchangeRate.model');

const api_key = process.env.NAVASAN_API_KEY;

async function updateExchangeRate() {
  try {
    const response = await fetch(`https://api.navasan.tech/latest/?api_key=${api_key}`);
    const data = await response.json();
    
    await ExchangeRate.findOneAndUpdate(
      { currency: 'AED' },
      { 
        rate: data.aed.value,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    console.log('✅ نرخ ارز آپدیت شد:', data.aed.value);
  } catch (error) {
    console.error('❌ خطا در آپدیت نرخ ارز:', error);
  }
}

async function getExchangeRate() {
  const rate = await ExchangeRate.findOne({ currency: 'AED' });
  return rate?.rate || null;
}

module.exports = { updateExchangeRate, getExchangeRate };