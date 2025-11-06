const controller = require("../.controller");


class authController extends controller {
  async otp(req, res, next) {
    try {
        const { phone } = req.body;
        const user = await User.findOne({ phone });
        if (!user) 
            return res.status(404).json({ message: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000);
        const otpExpiresAt = Date.now() + 10 * 60 * 1000;
        await user.save();
        return res.render("auth/otp", { otp, otpExpiresAt });   
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req, res, next) {
    try {
        const { otp } = req.body;
        const user = await User.findOne({ 'otp.code': otp });
        const cookieOptions = {
            ...this.getCookieOptions(),
            maxAge: 24 * 60 * 60 * 1000
          };

        if (!user)
            return req.flash('error_msg', 'کد وارد شده معتبر نیست');
        req.flash('success_msg', 'کد وارد شده معتبر است');
        res.cookie('token', user.id, cookieOptions);
        return res.redirect('/dashboard');
    } catch (err) {
      next(err);
    }
  }

  getCookieOptions() {
    return {
      httpOnly: process.env.NODE_ENV === 'production',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: process.env.NODE_ENV === 'production' ?  process.env.COOKIE_DOMAIN : "",
    };
  }

}

module.exports = new authController();