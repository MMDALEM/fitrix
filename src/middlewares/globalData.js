const categoriesModel = require("../models/categories.model");

const globalData = async (req, res, next) => {
  try {
    res.locals.categories = await categoriesModel
      .find({ isActive: true })
      .populate("subCategories");
  } catch (error) {
    res.locals.categories = [];
  }
  next();
};

module.exports = globalData;