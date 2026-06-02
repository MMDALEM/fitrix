const autoBind = require("auto-bind-inheritance");

module.exports = class controller {
  constructor() {
    autoBind(this);
  }

  back(req, res) {
    req.flash("formData", req.body);
    return res.redirect(req.header("Referer") || "/");
  }

  review(req, res, url) {
    req.flash("formData", req.body);
    return res.redirect(`${String(url)}`);
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
