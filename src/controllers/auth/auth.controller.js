const controller = require("../.controller");
const userModel = require("../../models/user.model");
const { generateOtp, jwtSign } = require("../../utils/function");

class authController extends controller {
  async auth(req, res, next) {
    try {
      return res.render("auth/auth");
    } catch (err) {
      next(err);
    }
  }

  async verifyAuth(req, res, next) {
    try {
      // await getotpSchema.validateAsync(req.body);
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
      // await sms(phone,code);

      const cookie_otp = {
        phone: phone,
        expiresIn: user?.otp?.expiresIn,
      };

      res.cookie("fitrix_otp", JSON.stringify(cookie_otp), {
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        domain:
          process.env.NODE_ENV === "production"
            ? process.env.COOKIE_DOMAIN
            : "",
        maxAge: 10 * 60 * 1000,
      });

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
      return res.render("auth/otp", { phone, expiresIn });
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

      const token = await jwtSign(user.id);

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
          title: "اعتبار سنجی با موفقیت انجام شد",
          icon: "success",
        },
        "/dashboard",
      );
    } catch (err) {
      console.log(err);
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
        "/",
      );
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new authController();
