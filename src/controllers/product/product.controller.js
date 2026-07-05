const productModel = require("../../models/product.model");
const controller = require("../.controller");

class productController extends controller {
  async productSingle(req, res, next) {
    try {
      const product = await productModel
        .findOne({ slug: req.params.slug })
        .populate("category")
        .populate("brand")
        .exec();

      if (!product) {
        return next(); // به هندلر ۴۰۴ سپرده می‌شود
      }

      // شمارش بازدید (بدون انتظار برای نتیجه)
      productModel
        .updateOne({ _id: product._id }, { $inc: { viewsCount: 1 } })
        .catch(() => {});

      const products = await productModel
        .find({ category: product.category?._id, _id: { $ne: product._id } })
        .sort({ createdAt: -1 })
        .limit(10);

      // ---------- SEO ----------
      const siteUrl = `${req.protocol}://${req.get("host")}`;
      const plainDesc = String(product.description || "")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const metaDescription =
        (plainDesc.length > 155 ? plainDesc.slice(0, 155) + "…" : plainDesc) ||
        `خرید ${product.title} اورجینال با بهترین قیمت از فیت ریکس شاپ.`;

      return res.render("shop/singleProduct", {
        product,
        products,
        pageTitle: `خرید ${product.title}`,
        metaDescription,
        canonicalUrl: `${siteUrl}/product/${encodeURIComponent(product.slug)}`,
        ogImage: product.image ? siteUrl + product.image : undefined,
        ogType: "product",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new productController();
