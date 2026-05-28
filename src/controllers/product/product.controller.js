const productModel = require("../../models/product.model");
const controller = require("../.controller");

class productController extends controller {
  async productSingle(req, res, next) {
    try {
      const product = await productModel
        .findOne({ slug: req.params.slug })
        .populate("category")
        .populate("brand")
        .exec();

      const products = await productModel
        .find({ category: product.category })
        .sort({ createdAt: -1 })
        .limit(10);

      return res.render("shop/singleProduct", { product, products });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new productController();
