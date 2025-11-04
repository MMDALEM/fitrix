const controller = require("../.controller");

class shopController extends controller {
  async shop(req, res, next) {
    try {
        return res.render("shop/shop");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new shopController();