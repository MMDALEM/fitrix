const { saveReturnTo } = require("../utils/token");

exports.checkBasketAccess = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      let title = "برای دسترسی به سبد خرید باید وارد شوید",
        icon = "info",
        timer = 5500;
      req.flash("sweetalert", { title, icon, timer });
      // بعد از ورود به همین صفحه برمی‌گردد
      saveReturnTo(req, res);
      return res.redirect("/auth");
    }

    next();
  } catch (err) {
    next(err);
  }
};
