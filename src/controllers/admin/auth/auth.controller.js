
const controller = require("../../.controller");
const userModel = require("../../../models/user.model");
const { generateOtp, jwtSign, randomString, hashPassword, comparePassword } = require("../../../utils/function");
const { authAdminSchema } = require("../../../validations/auth.validation");

class authAdminController extends controller {
  async auth(req, res, next) {
    try {
      return res.render("admin/auth");
    } catch (err) {
      next(err);
    }
  }

  async verifyAuth(req, res, next) {
    try {
      await authAdminSchema.validateAsync(req.body);
      const { username, password } = req.body;
      const user = await this.checkExistUser(username);
      const date = Date.now();

      if (!user)
        return this.alertAndBack(req, res, {
          title: "کاربر با این نام کاربری از یافت نشد یا رمز عبور اشتباه است",
          icon: "error",
        });

      const isMatch = await comparePassword(password, user.password);

      if (!user || !isMatch)
        return this.alertAndBack(req, res, {
          title: "کاربر با این نام کاربری از یافت نشد یا رمز عبور اشتباه است",
          icon: "error",
        });

      // فقط کاربران دارای نقش ادمین اجازه‌ی ورود به پنل را دارند
      const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
      if (!roles.includes("ADMIN") && !roles.includes("SUPER_ADMIN")) {
        return this.alertAndBack(req, res, {
          title: "شما دسترسی به پنل مدیریت ندارید",
          icon: "error",
        });
      }

      const token = await jwtSign(user._id);


      res.cookie("fitrix_token", token, {
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        domain:
          process.env.NODE_ENV === "production"
            ? process.env.COOKIE_DOMAIN
            : "",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return this.alertAndReview(
        req,
        res,
        {
          title: "ورود با موفقیت انجام شد",
          icon: "success",
        },
        `/admin`
      );
    } catch (err) {
      next(err);
    }
  }

  async checkExistUser(username) {
    return await userModel.findOne({ username });
  }

  async hashPassword(req, res, next) {
    try {
      const pass = randomString();

      const hash = await hashPassword(pass);

      return res.json({ pass, hash });

    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      res.clearCookie("fitrix_token", {
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        domain:
          process.env.NODE_ENV === "production"
            ? process.env.COOKIE_DOMAIN
            : "",
      });

      res.clearCookie("fitrix_otp", {
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        domain:
          process.env.NODE_ENV === "production"
            ? process.env.COOKIE_DOMAIN
            : "",
      });

      return this.alertAndReview(
        req,
        res,
        {
          title: "با موفقیت خارج شدید",
          icon: "success",
        },
        "/"
      );
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new authAdminController();
