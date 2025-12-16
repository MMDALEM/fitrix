const categoriesModel = require("../../../models/categories.model");
const controller = require("../../.controller");


class productController extends controller {
  async create(req, res, next) {
    try {
      const { name, slug, description, type } = req.body;

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

}

module.exports = new productController();
