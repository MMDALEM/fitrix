const controller = require("../.controller");
const userModel = require("../../models/user.model");
const { generateOtp, sendCode } = require("../../utils/function");
const {
  issueTokens,
  setAuthCookies,
  clearAuthCookies,
  revokeRefreshToken,
  popReturnTo,
  saveReturnToReferer,
  cookieOptions,
} = require("../../utils/token");
const JWT = require("jsonwebtoken");
const { authSchema } = require("../../validations/auth.validation");

class authController extends controller {
  async auth(req, res, next) {
    try {
      saveReturnToReferer(req, res);
      return res.render("auth/auth", {
        pageTitle: "ورود | ثبت‌نام",
        noindex: true,
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyAuth(req, res, next) {
    try {
      await authSchema.validateAsync(req.body);
      const { phone } = req.body;
      const code = generateOtp();
      const user = await this.checkExistUser(phone);

      const date = Date.now();
      if (user) {
        if (date <= user?.otp?.expiresIn)
          return this.alertAndBack(req, res, {
            title: "کد تایید به تازگی برای شماارسال شده، لطفا صبر کنید",
            icon: "error",
          });

        await this.updateOtpForUser(phone, code);
      } else await this.register(phone, code);
      // await sendCode(phone, code + "");

      const cookie_otp = {
        phone: phone,
        expiresIn: user?.otp?.expiresIn,
      };

      res.cookie(
        "fitrix_otp",
        JSON.stringify(cookie_otp),
        cookieOptions(10 * 60 * 1000),
      );

      return this.alertAndReview(
        req,
        res,
        {
          title: "کد یک بار مصرف برای شماارسال شد ",
          icon: "success",
        },
        `auth/otp`,
      );
    } catch (err) {
      next(err);
    }
  }

  async otp(req, res, next) {
    try {
      if (!req.cookies.fitrix_otp)
        return this.alertAndBack(req, res, {
          title: "خطا در اعتبارسنجی کاربر",
          icon: "error",
        });

      const { phone, expiresIn } = JSON.parse(req.cookies.fitrix_otp);
      return res.render("auth/otp", {
        phone,
        expiresIn,
        pageTitle: "تایید کد یکبار مصرف",
        noindex: true,
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      if (!req.cookies.fitrix_otp)
        return this.alertAndBack(req, res, {
          title: "خطا در اعتبارسنجی کاربر",
          icon: "error",
        });

      const { phone, expiresIn } = JSON.parse(req.cookies.fitrix_otp);
      const code = `${req.body.num1}${req.body.num2}${req.body.num3}${req.body.num4}${req.body.num5}`;
      if (!code)
        return this.alertAndBack(req, res, {
          title: "کد وارد نشده",
          icon: "error",
        });

      const user = await userModel.findOne({ phone });
      if (!user)
        return this.alertAndBack(req, res, {
          title: "کاربر یافت نشد",
          icon: "error",
        });

      if (Date.now() > user.otp.expiresIn)
        return this.alertAndBack(req, res, {
          title: "کد منقضی شده است",
          icon: "error",
        });

      if (parseInt(code) !== user.otp.code)
        return this.alertAndBack(req, res, {
          title: "کد صحیح نیست",
          icon: "error",
        });

      // اکسس‌توکن کوتاه‌عمر + رفرش‌توکن بلندعمر
      const tokens = await issueTokens(user);
      setAuthCookies(res, tokens);
      res.clearCookie("fitrix_otp", cookieOptions());

      // اگر کاربر از صفحه‌ای به ورود هدایت شده بود، به همان‌جا برمی‌گردد
      const returnTo = popReturnTo(req, res) || "/";

      return this.alertAndReview(
        req,
        res,
        {
          title: "اعتبار سنجی با موفقیت انجام شد",
          icon: "success",
        },
        returnTo,
      );
    } catch (err) {
      next(err);
    }
  }

  async register(phone, code) {
    const otp = { code, expiresIn: Date.now() + 120000 };
    return await userModel.create({ phone, otp, roles: "USER" });
  }

  async checkExistUser(phone) {
    return await userModel.findOne({ phone });
  }

  async updateOtpForUser(phone, code) {
    const otp = { code, expiresIn: Date.now() + 120000 };
    return (
      (await userModel.updateOne({ phone }, { $set: { otp } })).modifiedCount >
      0
    );
  }

  async logout(req, res, next) {
    try {
      // ابطال رفرش‌توکن در دیتابیس (بهترین تلاش)
      try {
        const token = req.cookies.fitrix_token || req.cookies.fitrix_refresh;
        if (token) {
          const payload = JWT.decode(token);
          if (payload && payload.id) await revokeRefreshToken(payload.id);
        }
      } catch {}

      clearAuthCookies(res);
      res.clearCookie("fitrix_otp", cookieOptions());

      return this.alertAndReview(
        req,
        res,
        {
          title: "با موفقیت خارج شدید",
          icon: "success",
        },
        "/",
      );
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new authController();
