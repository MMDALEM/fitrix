const JWT = require("jsonwebtoken");
const userModel = require("../models/user.model");
const { verifyCookie } = require("../utils/function");

exports.verifyUser = async (req, res, next) => {
  try {
    const token = req.cookies.fitrix_token;
    if (!token) return res.redirect("/auth");

    const payload = JWT.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_USER);

    const isValid = await verifyCookie(payload.id, res);
    if (!isValid) return res.redirect("/auth");

    const user = await userModel.findById(payload.id, {
      phone: 1,
      isActive: 1,
      role: 1,
    });

    if (!user || !user.isActive) return res.redirect("/auth");

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      res.clearCookie("fitrix_token");
      return res.redirect("/auth");
    }
    next(err);
  }
};

exports.verifyAdmin = async (req, res, next) => {
  try {
    const token = req.cookies.fitrix_token;
    if (!token) return res.redirect("/auth");

    const payload = JWT.verify(
      token,
      process.env.JWT_ACCESS_TOKEN_SECRET_MANAGER
    );

    const isValid = await verifyCookie(payload.id, res);
    if (!isValid) return res.redirect("/auth");

    const user = await userModel.findById(payload.id, {
      phone: 1,
      isActive: 1,
      role: 1,
    });

    if (!user || !user.isActive) return res.redirect("/auth");
    if (user.role !== "ADMIN") return res.redirect("/");

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      res.clearCookie("fitrix_token");
      return res.redirect("/auth");
    }
    next(err);
  }
};

exports.isGuest = async (req, res, next) => {
  try {
    const token = req.cookies.fitrix_token;
    if (!token) return next();

    const payload = JWT.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_USER);
    const user = await userModel.findById(payload.id, { role: 1 });

    if (user) {
      return user.role === "ADMIN" ? res.redirect("/admin") : res.redirect("/");
    }
    next();
  } catch {
    res.clearCookie("fitrix_token");
    next();
  }
};