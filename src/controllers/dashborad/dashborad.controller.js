const controller = require("../.controller");

class dashboradController extends controller {
  async dashborad(req, res, next) {
    try {
        return res.render("dashborad/dashborad");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new dashboradController();