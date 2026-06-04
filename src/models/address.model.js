const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    title: { type: String },
    country: { type: String, default: "ایران" },
    address: { type: String },
    receiver: { type: String },
    postalCode: { type: String },
    phone: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Address", addressSchema);
