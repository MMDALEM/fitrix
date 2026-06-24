const JWT = require("jsonwebtoken");
const userModel = require("../models/user.model");
const categoriesModel = require("../models/categories.model");
const basketModel = require("../models/basket.model");
const addressModel = require("../models/address.model");

class GlobalData {
  static async auth(req, res, next) {
    try {
      const token = req.cookies.fitrix_token;
      if (!token) {
        req.user = null;
        res.locals.user = null;
        return next();
      }

      const payload = JWT.verify(
        token,
        process.env.JWT_ACCESS_TOKEN_SECRET_USER,
      );

      const user = await userModel.findById(payload.id, {
        phone: 1,
        isActive: 1,
        roles: 1,
        name: 1,
        avatar: 1,
      });

      const addresses = await addressModel.find({ user: user._id });

      if (user && user.isActive) {
        req.user = user;
        res.locals.user = user;
        res.locals.addresses = addresses;
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

  static async setLocals(req, res, next) {
    try {
      const PRODUCT_SELECT = "title image slug priceSingle quantity";

      res.locals.user = req.user || null;

      if (req.user) {
        const basket = await basketModel
          .findOne({ user: req.user._id, status: "active" })
          .populate("items.product", PRODUCT_SELECT)
          .lean();

        res.locals.basket = basket || { items: [] };
      } else {
        res.locals.basket = { items: [] };
      }

      next();
    } catch (err) {
      console.log("LOCALS ERROR:", err.message);
      res.locals.basket = { items: [] };
      next();
    }
  }

  static init() {
    return [this.auth, this.categories, this.settings, this.setLocals];
  }
}

module.exports = GlobalData;
