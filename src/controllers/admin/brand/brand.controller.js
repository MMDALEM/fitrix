const brandModel = require("../../../models/brand.model");
const controller = require("../../.controller");
const fs = require("fs");

class brandController extends controller {
  async brand(req, res, next) {
    try {
      return res.render("admin/brand");
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { title, description, country, website, displayOrder } = req.body;

      const slug = this.slugify(title);
      const image = `/uploads/files/brand/${req.file.filename}`;

      console.log(country, website);

      await brandModel.create({
        title,
        slug,
        description,
        image,
        country,
        website,
        displayOrder,
      });

      return this.alertAndBack(req, res, {
        title: "برند با موفقیت ایجاد شد",
        icon: "success",
      });
    } catch (err) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      if (err.code === 11000) {
        return this.alertAndBack(req, res, {
          title: "چنین برندی از قبل وجود دارد",
          icon: "error",
        });
      }
      next(err);
    }
  }
}

module.exports = new brandController();
