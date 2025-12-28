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

    res.cookie('flash', JSON.stringify(flashData), {
      httpOnly: false,
      maxAge: 5000,
      path: '/'
    });
  };

  next();
};

module.exports = flash;