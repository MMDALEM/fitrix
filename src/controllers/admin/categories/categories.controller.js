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
      // شناسه‌ی دسته‌ی والد (از فیلد parent یا subCategories پشتیبانی می‌شود)
      const parentId = req.body.parent || req.body.subCategories;

      const parent = await categoriesModel.findById(parentId);
      if (!parent)
        return this.alertAndBack(req, res, {
          title: "دسته‌بندی والد یافت نشد",
          icon: "error",
        });

      const { title, description, isActive, image } = req.body;
      const slug = this.slugify(title);

      // ساخت زیردسته با والد درست + سطح بر اساس والد
      const child = await categoriesModel.create({
        title,
        slug,
        description,
        type: "sub",
        parent: parent._id,
        level: (parent.level || 0) + 1,
        isActive: isActive !== undefined ? isActive : true,
        image,
      });

      // افزودن زیردسته به لیست زیردسته‌های والد
      if (
        !parent.subCategories.some(
          (id) => id.toString() === child._id.toString(),
        )
      ) {
        parent.subCategories.push(child._id);
        await parent.save();
      }

      return this.alertAndBack(req, res, {
        title: "زیر دسته‌بندی با موفقیت ایجاد شد",
        icon: "success",
      });
    } catch (err) {
      if (err.code === 11000)
        return this.alertAndBack(req, res, {
          title: "چنین دسته‌بندی‌ای از قبل وجود دارد",
          icon: "error",
        });
      next(err);
    }
  }
}

module.exports = new categoriesController();
