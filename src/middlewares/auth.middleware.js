const JWT = require("jsonwebtoken");
const userModel = require("../models/user.model");
const {
  refreshSession,
  clearAuthCookies,
  saveReturnTo,
} = require("../utils/token");

const USER_FIELDS = { phone: 1, isActive: 1, roles: 1, name: 1, avatar: 1 };

// تلاش برای احراز هویت: اول اکسس‌توکن، بعد رفرش‌توکن (تمدید بی‌صدا)
async function resolveUser(req, res) {
  const token = req.cookies.fitrix_token;

  if (token) {
    try {
      const payload = JWT.verify(
        token,
        process.env.JWT_ACCESS_TOKEN_SECRET_USER,
      );
      const user = await userModel.findById(payload.id, USER_FIELDS);
      if (user && user.isActive) return user;
      clearAuthCookies(res);
      return null;
    } catch {
      // اکسس‌توکن منقضی/نامعتبر → سراغ رفرش می‌رویم
    }
  }

  const refreshed = await refreshSession(req, res);
  if (refreshed) {
    return userModel.findById(refreshed._id, USER_FIELDS);
  }
  return null;
}

exports.resolveUser = resolveUser;

exports.verifyUser = async (req, res, next) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) {
      // مسیر فعلی ذخیره می‌شود تا بعد از ورود به همین‌جا برگردد
      saveReturnTo(req, res);
      return res.redirect("/auth");
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

exports.verifyAdmin = async (req, res, next) => {
  try {
    const user = await resolveUser(req, res);
    if (!user) {
      saveReturnTo(req, res);
      return res.redirect("/admin/auth");
    }

    // roles یک آرایه است (مثلاً ["USER"] یا ["ADMIN"])
    const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
    if (!roles.includes("ADMIN") && !roles.includes("SUPER_ADMIN")) {
      return res.redirect("/");
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

exports.isGuest = async (req, res, next) => {
  try {
    const user = await resolveUser(req, res);
    if (user) {
      const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
      return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")
        ? res.redirect("/admin")
        : res.redirect("/");
    }
    next();
  } catch {
    next();
  }
};
