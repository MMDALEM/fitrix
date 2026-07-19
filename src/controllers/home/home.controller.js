const brandModel = require("../../models/brand.model");
const productModel = require("../../models/product.model");
const categoriesModel = require("../../models/categories.model");
const slideModel = require("../../models/slide.model");
const controller = require("../.controller");

class homeController extends controller {
  async home(req, res, next) {
    try {
      const brands = await brandModel.find({ showInHomePage: true }).lean();

      // اسلایدهای بنر صفحه اصلی (قابل مدیریت از پنل ادمین)
      const slides = await slideModel
        .find({ isActive: true })
        .sort({ order: 1, createdAt: -1 })
        .lean();

      // اسلایدر «فروش شگفت‌انگیز»: فقط محصولاتی که در پنل ادمین شگفت‌انگیز
      // شده‌اند نمایش داده می‌شوند (پراهورمون‌ها/مخفی‌ها نمایش داده نمی‌شوند)
      const products = await productModel
        .find({
          amazing: true,
          isActive: true,
          siteHidden: { $ne: true },
          quantity: { $gt: 0 },
        })
        .sort({ updatedAt: -1 })
        .limit(12)
        .lean();

      return res.render("home/home", {
        brands,
        slides,
        products,
        pageTitle: "خرید مکمل ورزشی، پروتئین وی و کراتین اورجینال",
        metaDescription:
          "فروشگاه اینترنتی فیت ریکس (FitRix | fitrix.ir)؛ خرید مکمل ورزشی، پروتئین وی، کراتین، گینر، آمینو و ویتامین از برندهای معتبر جهانی با قیمت مناسب و ارسال سریع به سراسر ایران.",
        metaKeywords:
          "خرید مکمل, خرید مکمل ورزشی, مکمل بدنسازی, پروتئین وی, خرید پروتئین وی, کراتین, خرید کراتین, گینر, آمینو اسید, بی سی ای ای, ال کارنیتین, مولتی ویتامین, فیت ریکس شاپ, fitrix",
      });
    } catch (err) {
      next(err);
    }
  }

  // robots.txt — مسیرهای خصوصی از ایندکس خارج می‌شوند
  robots(req, res) {
    const siteUrl = `${req.protocol}://${req.get("host")}`;
    res.type("text/plain").send(
      [
        "User-agent: *",
        "Disallow: /admin",
        "Disallow: /dashboard",
        "Disallow: /basket",
        "Disallow: /auth",
        "Disallow: /payment",
        "Disallow: /logout",
        "Allow: /",
        "",
        `Sitemap: ${siteUrl}/sitemap.xml`,
      ].join("\n"),
    );
  }

  // sitemap.xml — صفحه اصلی، فروشگاه، دسته‌بندی‌ها و همه محصولات فعال
  async sitemap(req, res, next) {
    try {
      const siteUrl = `${req.protocol}://${req.get("host")}`;

      const [products, categories] = await Promise.all([
        productModel
          .find({ isActive: true, siteHidden: { $ne: true } }, "slug updatedAt")
          .sort({ updatedAt: -1 })
          .lean(),
        categoriesModel.find({ isActive: true }, "slug updatedAt").lean(),
      ]);

      const esc = (s) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const urlTag = (loc, lastmod, priority) =>
        "  <url>\n" +
        `    <loc>${esc(loc)}</loc>\n` +
        (lastmod
          ? `    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>\n`
          : "") +
        (priority ? `    <priority>${priority}</priority>\n` : "") +
        "  </url>";

      const urls = [
        urlTag(`${siteUrl}/`, null, "1.0"),
        urlTag(`${siteUrl}/shop`, null, "0.9"),
        urlTag(`${siteUrl}/consult`, null, "0.6"),
        ...categories.map((c) =>
          urlTag(
            `${siteUrl}/shop?category=${encodeURIComponent(c.slug)}`,
            c.updatedAt,
            "0.7",
          ),
        ),
        ...products.map((p) =>
          urlTag(
            `${siteUrl}/product/${encodeURIComponent(p.slug)}`,
            p.updatedAt,
            "0.8",
          ),
        ),
      ];

      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls.join("\n") +
        "\n</urlset>";

      return res.type("application/xml").send(xml);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new homeController();
