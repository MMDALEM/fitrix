const brandModel = require("../../models/brand.model");
const productModel = require("../../models/product.model");
const controller = require("../.controller");


class homeController extends controller {
  async home(req, res, next) {
    try {
      const brands = await brandModel.find();
      const products = await productModel.find();


      return res.render("home/home", { brands , products });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new homeController();