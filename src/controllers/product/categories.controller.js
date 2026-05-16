const categoriesModel = require("../../../models/categories.model");
const controller = require("../../.controller");

class categoriesController extends controller {
  async createCategories(req, res, next) {
    try {
      const { name, slug, description, type } = req.body;

      // Create the category
      const category = await categoriesModel.create({
        name,
        slug,
        description,
        type,
      });

      return res.status(201).json({ success: true, category });
    } catch (err) {
      next(err);
    }
  }

  async createSubCategories(req, res, next) {
    try {
      const sub = req.body.subCategories;

      const categories = await categoriesModel.findById(sub);
      if (!categories)
        return res
          .status(404)
          .json({ success: false, message: "Category not found" });

      const { name, slug, description, type, isActive, image } = req.body;

      const category = await categoriesModel.create({
        name,
        slug,
        description,
        type,
        subCategories: sub,
        isActive,
        image,
      });

      return res.status(201).json({ success: true, category });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new categoriesController();
