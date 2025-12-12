const categoriesModel = require("../../models/categories.model");
const controller = require("../.controller");


class homeController extends controller {
  async home(req, res, next) {
    try {
        return res.render("home/home");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new homeController();