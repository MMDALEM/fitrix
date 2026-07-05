const { resolveUser } = require("./auth.middleware");

// احراز هویت اختیاری برای صفحات عمومی:
// اگر توکن معتبر بود کاربر ست می‌شود، وگرنه به‌عنوان مهمان ادامه می‌دهد.
// (نسخه‌ی قبلی با توکن منقضی کاربر را از صفحات عمومی به /auth می‌فرستاد)
exports.verifyTokenPublic = async (req, res, next) => {
  try {
    const user = await resolveUser(req, res);
    if (user) req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
