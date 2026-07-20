// middlewares/flash.middleware.js
const flash = (req, res, next) => {
  let flashData = {};
  if (req.cookies.flash) {
    try {
      flashData = JSON.parse(req.cookies.flash);
      res.clearCookie('flash');
    } catch {
      flashData = {};
    }
  }

  res.locals.flash = flashData;

  req.flash = (type, message) => {
    // خواندن - array برگردون مثل connect-flash
    if (!message) {
      const result = flashData[type] || [];
      return Array.isArray(result) ? result : [result];
    }

    // ست کردن
    if (!flashData[type]) flashData[type] = [];
    if (Array.isArray(flashData[type])) {
      flashData[type].push(message);
    } else {
      flashData[type] = [flashData[type], message];
    }

    // محافظِ اندازه: کوکی‌ها سقفِ ~۴KB دارند و اگر هدرِ Set-Cookie خیلی
    // بزرگ شود nginx خطای «upstream sent too big header» و ۵۰۲ می‌دهد.
    // اگر داده‌ی فلش از حدِ امن بزرگ‌تر شد، آن را نمی‌نویسیم (به‌جای کرشِ کلِ پاسخ).
    const serialized = JSON.stringify(flashData);
    if (serialized.length > 3500) {
      console.warn('flash cookie skipped (too large):', serialized.length, 'bytes');
      return;
    }

    res.cookie('flash', serialized, {
      httpOnly: false,
      maxAge: 5000,
      path: '/'
    });
  };

  next();
};

module.exports = flash;