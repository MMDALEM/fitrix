const JWT = require("jsonwebtoken");
const userModel = require("../models/user.model");
const categoriesModel = require("../models/categories.model");

class GlobalData {
  static async auth(req, res, next) {
    try {
      const token = req.cookies.fitrix_token;
      if (!token) {
        req.user = null;
        res.locals.user = null;
        return next();
      }

      const payload = JWT.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_USER);
      const user = await userModel.findById(payload.id, {
        phone: 1,
        isActive: 1,
        role: 1,
        name: 1,
        avatar: 1,
      });

      if (user && user.isActive) {
        req.user = user;
        res.locals.user = user;
      } else {
        req.user = null;
        res.locals.user = null;
        res.clearCookie("fitrix_token");
      }
    } catch {
      req.user = null;
      res.locals.user = null;
      res.clearCookie("fitrix_token");
    }
    next();
  }

  static async categories(req, res, next) {
    try {
      res.locals.categories = await categoriesModel
        .find({ isActive: true })
        .populate("subCategories");
    } catch {
      res.locals.categories = [];
    }
    next();
  }

  static async settings(req, res, next) {
    try {
      res.locals.settings = {
        siteName: "FitRix",
        logo: "/images/logo.png",
        phone: "09373640517",
      };
    } catch {
      res.locals.settings = {};
    }
    next();
  }

  static init() {
    return [this.auth, this.categories, this.settings];
  }
}

module.exports = GlobalData;