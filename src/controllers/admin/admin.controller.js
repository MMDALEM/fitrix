const controller = require("../.controller");

class adminController extends controller {

  async admin(req, res, next) {
    try {
      return res.render('admin')
    } catch (err) {
      next(err);
    }
  }

}

module.exports = new adminController();
