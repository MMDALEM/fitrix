const productModel = require("../../models/product.model");
const controller = require("../.controller");

class productController extends controller {

  async shopSingle(req, res, next) {
    try {
      const product = await productModel.findOne({ slug: req.params.slug });
      return res.render("shop/singleProduct", { product });
    } catch (err) {
      next(err);
    }
  }

}

module.exports = new productController();