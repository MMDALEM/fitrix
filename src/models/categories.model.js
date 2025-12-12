const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      index: true,
      required: true,
    },
    subCategories: [{ type: Schema.Types.ObjectId,ref: "Categories" , default: [] }],
    isActive: {
      type: Boolean,
      default: true,
    },
    image: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Categories", categorySchema);
