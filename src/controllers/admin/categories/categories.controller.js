const categoriesModel = require("../../../models/categories.model");
const controller = require("../../.controller");

class categoriesController extends controller {
  async category(req, res, next) {
    try {
      return res.render("admin/category");
    } catch (err) {
      next(err);
    }
  }

  async createCategories(req, res, next) {
    try {
      const { title, description, type } = req.body;

      const slug = this.slugify(title);

      // Create the category
      await categoriesModel.create({
        title,
        slug,
        description,
        type,
      });

      return this.alertAndBack(req, res, {
        title: "دسته‌بندی با موفقیت ایجاد شد",
        icon: "success",
      });
    } catch (err) {
      if (err.code === 11000) {
        return this.alertAndBack(req, res, {
          title: "چنین دسته‌بندی‌ای از قبل وجود دارد",
          icon: "error",
        });
      }
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

      await categoriesModel.create({
        name,
        slug,
        description,
        type,
        subCategories: sub,
        isActive,
        image,
      });

      return this.alertAndBack(req, res, {
        title: "زیر دسته‌بندی با موفقیت ایجاد شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new categoriesController();
