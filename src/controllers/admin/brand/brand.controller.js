const brandModel = require("../../../models/brand.model");
const controller = require("../../.controller");

class brandController extends controller {
  async create(req, res, next) {
    try {
      const {
        title,
        description,
        image,
        logo,
        country,
        website,
        displayOrder,
        productCount,
        type,
      } = req.body;

      const slug = this.slugify(title);

      const category = await brandModel.create({
        title,
        slug,
        description,
        image,
        logo,
        country,
        website,
        displayOrder,
        productCount,
        type,
      });

      return res.status(201).json({ success: true, category });
    } catch (err) {
      next(err);
    }
  }

  // async address(req, res, next) {
  //   try {
  //     const addresses = await addressModel.find({ user: req.user._id });
  //     return res.render("dashborad/address", { addresses });
  //   } catch (err) {
  //     next(err);
  //   }
  // }
}

module.exports = new brandController();
