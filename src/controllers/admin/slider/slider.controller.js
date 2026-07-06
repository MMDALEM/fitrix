const fs = require("fs");
const mongoose = require("mongoose");
const slideModel = require("../../../models/slide.model");
const controller = require("../../.controller");

class sliderController extends controller {
  async index(req, res, next) {
    try {
      const slides = await slideModel
        .find()
        .sort({ order: 1, createdAt: -1 })
        .lean();
      return res.render("admin/slider/index", { slides });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      if (!req.file)
        return this.alertAndBack(req, res, {
          title: "آپلود تصویر اسلاید الزامی است",
          icon: "error",
        });

      const { link, alt, order } = req.body;
      await slideModel.create({
        image: `/uploads/files/slider/${req.file.filename}`,
        link: link && link.trim() ? link.trim() : "/shop",
        alt: alt || "",
        order: Number(order) || 0,
        isActive: true,
      });

      return this.alertAndBack(req, res, {
        title: "اسلاید با موفقیت اضافه شد",
        icon: "success",
      });
    } catch (err) {
      if (req.file) fs.unlink(req.file.path, () => {});
      next(err);
    }
  }

  async toggle(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return next();
      const slide = await slideModel.findById(id);
      if (!slide)
        return this.alertAndBack(req, res, {
          title: "اسلاید یافت نشد",
          icon: "error",
        });
      slide.isActive = !slide.isActive;
      await slide.save();
      return this.alertAndBack(req, res, {
        title: slide.isActive ? "اسلاید فعال شد" : "اسلاید غیرفعال شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return next();
      const slide = await slideModel.findByIdAndDelete(id);
      if (slide && slide.image) {
        fs.unlink(`public${slide.image}`, () => {});
      }
      return this.alertAndBack(req, res, {
        title: "اسلاید حذف شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new sliderController();
