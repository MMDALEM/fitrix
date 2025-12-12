const categoriesModel = require("../../../models/categories.model");
const controller = require("../../.controller");


class categoriesController extends controller {
  async allCategories(req, res, next) {
    try {
      const categories = await categoriesModel.find().populate("subCategories");
      const subCategories = categories.flatMap(cat => cat.subCategories || []);

      return res.status(200).json({ success: true, categories, subCategories });
    } catch (err) {
      next(err);
    }
  }

}

module.exports = new categoriesController();
