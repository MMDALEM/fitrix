
const controller = require("../../.controller");
const userModel = require("../../../models/user.model");
const { randomString, hashPassword, comparePassword } = require("../../../utils/function");
const { issueTokens, setAuthCookies } = require("../../../utils/token");
const { authAdminSchema } = require("../../../validations/auth.validation");
const { rateLimit, resetRateLimit } = require("../../../utils/rateLimiter");

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
      // جلوگیری از brute-force: حداکثر ۱۰ تلاش در هر ۱۵ دقیقه برای هر IP
      const ip = req.ip || req.socket?.remoteAddress || "unknown";
      const rlKey = `admin_login:${ip}`;
      if (rateLimit(rlKey, { max: 10, windowMs: 15 * 60 * 1000 }).limited) {
        return this.alertAndBack(req, res, {
          title: "تعداد تلاش‌های ناموفق زیاد است. چند دقیقه بعد دوباره تلاش کنید.",
          icon: "error",
        });
      }

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

      // اکسس‌توکن کوتاه‌عمر + رفرش‌توکن بلندعمر
      const tokens = await issueTokens(user);
      setAuthCookies(res, tokens);
      resetRateLimit(rlKey); // ورودِ موفق → شمارنده صفر می‌شود

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
