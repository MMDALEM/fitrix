const mongoose = require("mongoose");

const exchangeRateSchema = new mongoose.Schema({
  currency: {
    type: String,
    required: true,
    default: "AED",
  },
  rateInRials: {
    type: Number,
    required: true,
  },
  rateInToman: {
    type: Number,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ExchangeRate", exchangeRateSchema);
