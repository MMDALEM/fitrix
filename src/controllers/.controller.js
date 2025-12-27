const autoBind = require('auto-bind-inheritance');

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
    return res.redirect(`${url}`);
  }
  
  alert(req, data) {
    let title = data.title || "",
        icon = data.icon || "info",
        button = data.button || null,
        timer = data.timer || 4500;
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
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }

};