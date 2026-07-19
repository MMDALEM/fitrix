// ───────────────────────────────────────────────────────────────
// اندپوینتِ محصولاتِ ترب — Torob Product API v3
// ترب با POST به این اندپوینت درخواست می‌فرستد و ما محصولات را در
// قالبِ استانداردِ ترب برمی‌گردانیم. سه نوع درخواست پشتیبانی می‌شود:
//   ۱) لیستِ صفحه‌بندی‌شده: {"page":1,"sort":"date_added_desc"}
//   ۲) بر اساسِ URL:        {"page_urls":["https://site/product/slug/"]}
//   ۳) بر اساسِ شناسه:      {"page_uniques":["<id>"]}
//
// همه‌ی سه نوع، ساختارِ پاسخِ یکسان دارند:
//   { api_version, current_page, total, max_pages, products:[...] }
//
// نکته‌ی مهم: محصولاتِ مخفیِ سایت (siteHidden) و غیرفعال هرگز به ترب
// داده نمی‌شوند — دقیقاً مثلِ خودِ سایت.
// ───────────────────────────────────────────────────────────────
const controller = require("../.controller");
const productModel = require("../../models/product.model");

const PAGE_SIZE = 100;

// فقط محصولاتِ قابلِ نمایش در سایت به ترب داده می‌شوند
const BASE_FILTER = { isActive: true, siteHidden: { $ne: true } };

const SORTS = {
  date_added_desc: { createdAt: -1 },
  date_added_asc: { createdAt: 1 },
  price_asc: { priceSingle: 1 },
  price_desc: { priceSingle: -1 },
};

class torobController extends controller {
  async products(req, res) {
    try {
      const b = req.body && typeof req.body === "object" ? req.body : {};

      // نوعِ ۲ — بر اساسِ page_urls
      if (Array.isArray(b.page_urls)) {
        const slugs = b.page_urls
          .map((u) => this._slugFromUrl(u))
          .filter(Boolean);
        const docs = slugs.length
          ? await productModel
              .find({ ...BASE_FILTER, slug: { $in: slugs } })
              .populate("category", "title").populate("brand", "title")
              .lean()
          : [];
        return res.json(this._envelope(req, docs, 1, docs.length, 1));
      }

      // نوعِ ۳ — بر اساسِ page_uniques (شناسه‌ای که خودمان دادیم = _id)
      if (Array.isArray(b.page_uniques)) {
        const ids = b.page_uniques
          .map((x) => String(x || "").trim())
          .filter((x) => /^[a-f\d]{24}$/i.test(x));
        const docs = ids.length
          ? await productModel
              .find({ ...BASE_FILTER, _id: { $in: ids } })
              .populate("category", "title").populate("brand", "title")
              .lean()
          : [];
        return res.json(this._envelope(req, docs, 1, docs.length, 1));
      }

      // نوعِ ۱ — لیستِ صفحه‌بندی‌شده. طبقِ داکیومنت sort الزامی است.
      if (!b.sort) {
        return res.status(400).json({ error: "sort parameter is not provided" });
      }
      const sort = SORTS[b.sort] || SORTS.date_added_desc;
      const page = Math.max(1, parseInt(b.page, 10) || 1);

      const total = await productModel.countDocuments(BASE_FILTER);
      const maxPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const docs = await productModel
        .find(BASE_FILTER)
        .populate("category", "title").populate("brand", "title")
        .sort(sort)
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean();

      return res.json(this._envelope(req, docs, page, total, maxPages));
    } catch (err) {
      require("../../utils/logError").logError(err, { source: "torob-api" });
      return res.status(500).json({ error: "internal error" });
    }
  }

  // ── ساختِ پاکتِ استانداردِ پاسخِ ترب ──
  _envelope(req, docs, currentPage, total, maxPages) {
    return {
      api_version: "torob_api_v3",
      current_page: currentPage,
      total,
      max_pages: maxPages,
      products: docs.map((p) => this._mapProduct(req, p)),
    };
  }

  // ── نگاشتِ یک محصولِ سایت به قالبِ ترب ──
  _mapProduct(req, p) {
    const onSale = this._saleActive(p);
    const current = Math.round(onSale ? p.salePrice : p.priceSingle) || 0;

    const out = {
      page_unique: String(p._id),
      page_url: this._absUrl(req, `/product/${p.slug}`),
      title: p.title,
      current_price: current,
      availability: p.isActive === true && Number(p.quantity) > 0,
      image_links: p.image ? [this._absUrl(req, p.image)] : [],
      date_added: this._iso(p.createdAt),
    };

    if (onSale && p.priceSingle > current) out.old_price = Math.round(p.priceSingle);
    if (p.category && p.category.title) out.category_name = p.category.title;
    if (p.description) out.short_desc = String(p.description).slice(0, 500);
    if (p.updatedAt) out.date_updated = this._iso(p.updatedAt);

    // مشخصاتِ فنیِ اختیاری (spec) — فقط مقادیرِ موجود
    const spec = {};
    if (p.brand && p.brand.title) spec["برند"] = p.brand.title;
    if (p.weight) spec["وزن"] = String(p.weight);
    if (p.flavor) spec["طعم"] = String(p.flavor);
    if (p.servings) spec["تعداد سروینگ"] = String(p.servings);
    if (Object.keys(spec).length) out.spec = spec;

    return out;
  }

  // آیا تخفیفِ محصول همین حالا فعال است؟ (نسخه‌ی lean، بدونِ متدِ مدل)
  _saleActive(p) {
    if (!p.onSale || !p.salePrice || p.salePrice <= 0) return false;
    const now = new Date();
    if (p.saleStartDate && new Date(p.saleStartDate) > now) return false;
    if (p.saleEndDate && new Date(p.saleEndDate) < now) return false;
    return true;
  }

  _absUrl(req, pathPart) {
    if (!pathPart) return "";
    if (/^https?:\/\//i.test(pathPart)) return pathPart;
    const base = String(
      process.env.SITE_URL || `${req.protocol}://${req.get("host")}`,
    ).replace(/\/+$/, "");
    return base + (pathPart.startsWith("/") ? pathPart : "/" + pathPart);
  }

  _iso(d) {
    try {
      return new Date(d).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  // استخراجِ slug از آدرسِ محصول (آخرین بخشِ مسیر)
  _slugFromUrl(u) {
    try {
      const s = String(u || "").trim();
      if (!s) return "";
      const path = s.replace(/^https?:\/\/[^/]+/i, "").split("?")[0];
      const segs = path.split("/").filter(Boolean);
      const idx = segs.indexOf("product");
      if (idx !== -1 && segs[idx + 1]) return decodeURIComponent(segs[idx + 1]);
      return segs.length ? decodeURIComponent(segs[segs.length - 1]) : "";
    } catch {
      return "";
    }
  }
}

module.exports = new torobController();
