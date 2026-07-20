const autoBind = require("auto-bind-inheritance");

module.exports = class controller {
  constructor() {
    autoBind(this);
  }

  // نکته‌ی مهم: formData ِ کاملِ req.body دیگر در فلش ذخیره نمی‌شود.
  // میدل‌ویرِ فلش داده را در «کوکی» می‌گذارد؛ ذخیره‌ی کلِ فرم (مثلاً
  // توضیحاتِ بلندِ محصول) کوکی را چند کیلوبایت می‌کرد و هدرِ Set-Cookie از
  // حدِ nginx بزرگ‌تر می‌شد → خطای «upstream sent too big header» و ۵۰۲.
  // این داده هم هیچ‌جا خوانده نمی‌شد، پس حذفش بی‌خطر است.
  back(req, res) {
    return res.redirect(req.header("Referer") || "/");
  }

  review(req, res, url) {
    const target = url.startsWith("/") ? url : `/${url}`;
    return res.redirect(target);
  }

  alert(req, data) {
    let title = data.title || "",
      icon = data.icon || "info",
      button = data.button || null,
      timer = data.timer || 5500;
    req.flash("sweetalert", { title, icon, button, timer });
  }

  alertAndBack(req, res, data) {
    this.alert(req, data);
    this.back(req, res);
  }

  alertAndReview(req, res, data, url) {
    this.alert(req, data);
    this.review(req, res, url);
  }

  slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\u0600-\u06FF\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  }
};
