const productModel = require("../../models/product.model");
const controller = require("../.controller");

// ───────────────────────────────────────────────
// مشاور هوش مصنوعی مکمل‌های ورزشی
// از هر API سازگار با OpenAI استفاده می‌کند. در .env تنظیم کنید:
//   AI_API_URL   (پیش‌فرض: OpenRouter)
//   AI_API_KEY   (کلید — برای OpenRouter رایگان از openrouter.ai بگیرید)
//   AI_MODEL     (پیش‌فرض: مدل رایگان)
// ───────────────────────────────────────────────

// URL و کلید تمیز می‌شوند تا اشتباهات رایج .env (فاصله، کوتیشن، آدرس پایه
// بدون مسیر chat/completions) باعث خطای 401/404 نشوند
function normalizeUrl(raw) {
  let url = String(raw || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!url) return "https://openrouter.ai/api/v1/chat/completions";
  if (!/\/chat\/completions\/?$/.test(url)) {
    url = url.replace(/\/+$/, "") + "/chat/completions";
  }
  return url;
}

const AI_API_URL = normalizeUrl(process.env.AI_API_URL);
// AI_MODEL می‌تواند چند مدل جداشده با ویرگول باشد؛ اگر اولی جواب نداد
// (حذف‌شده/شلوغ)، به‌ترتیب مدل بعدی امتحان می‌شود
const AI_MODELS = (
  process.env.AI_MODEL || "meta-llama/llama-3.3-70b-instruct:free"
)
  .replace(/["']/g, "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const AI_MODEL = AI_MODELS[0];
const apiKey = () =>
  (process.env.AI_API_KEY || "").trim().replace(/^["']|["']$/g, "");

// ── کشف خودکار مدل‌های رایگان OpenRouter (کش ۳۰ دقیقه) ──
// فهرست :free مدام تغییر می‌کند؛ به‌جای اسم ثابت در .env، فهرست زنده گرفته
// می‌شود. مدل‌های طبقه‌بند ایمنی (Guard و مشابه) که چت‌بات نیستند حذف می‌شوند.
const BAD_MODEL_RE = /guard|moderat|safety|shield|classifier/i;
const PREFERRED_FAMILIES = [
  /llama-4|llama-3\.3/i,
  /deepseek-chat|deepseek-v3/i,
  /qwen3|qwen-3|qwen2\.5/i,
  /gemini/i,
  /gpt-oss/i,
  /mistral|mixtral/i,
];
let freeModelsCache = { list: [], at: 0 };

async function discoverFreeModels() {
  // فقط وقتی مقصد OpenRouter است معنا دارد
  if (!AI_API_URL.includes("openrouter.ai")) return [];
  const now = Date.now();
  if (freeModelsCache.list.length && now - freeModelsCache.at < 30 * 60 * 1000)
    return freeModelsCache.list;

  try {
    const r = await fetch("https://openrouter.ai/api/v1/models");
    if (!r.ok) return freeModelsCache.list;
    const data = await r.json();
    const score = (id) => {
      const i = PREFERRED_FAMILIES.findIndex((re) => re.test(id));
      return i === -1 ? PREFERRED_FAMILIES.length : i;
    };
    const list = (data?.data || [])
      .filter(
        (m) =>
          typeof m?.id === "string" &&
          m.id.endsWith(":free") &&
          !BAD_MODEL_RE.test(m.id),
      )
      .sort(
        (a, b) =>
          score(a.id) - score(b.id) ||
          (b.context_length || 0) - (a.context_length || 0),
      )
      .map((m) => m.id)
      .slice(0, 8);

    if (list.length) freeModelsCache = { list, at: now };
    return freeModelsCache.list;
  } catch {
    return freeModelsCache.list;
  }
}

// محدودیت نرخ ساده در حافظه: هر IP حداکثر ۱۰ پیام در ۵ دقیقه
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 10;
const rateMap = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  rateMap.set(ip, entry);
  // پاک‌سازی تنبل برای جلوگیری از رشد بی‌رویه
  if (rateMap.size > 5000) rateMap.clear();
  return entry.count > RATE_MAX;
}

// کش ۵ دقیقه‌ای فهرست محصولات برای پرامپت سیستم + لینک‌سازی پاسخ
let catalogCache = { text: "", items: [], at: 0 };

async function getCatalogText() {
  const now = Date.now();
  if (catalogCache.text && now - catalogCache.at < 5 * 60 * 1000)
    return catalogCache.text;

  // همه‌ی محصولات موجود فرستاده می‌شوند تا مدل از بین کل فروشگاه انتخاب کند
  // (سقف ۳۰۰ فقط محافظ حجم پرامپت است). گروه‌بندی بر اساس دسته تا مدل
  // محصولات مشابه (مثلاً همه‌ی وی‌ها) را کنار هم ببیند.
  const products = await productModel
    .find({ isActive: true, quantity: { $gt: 0 } }, "title priceSingle slug")
    .populate("category", "title")
    .sort({ category: 1, soldCount: -1 })
    .limit(300)
    .lean();

  const text = products
    .map(
      (p) =>
        `- ${p.title} | ${p.category?.title || "-"} | ${(
          p.priceSingle || 0
        ).toLocaleString("fa-IR")} تومان | /product/${p.slug}`,
    )
    .join("\n");

  catalogCache = {
    text,
    items: products.map((p) => ({ title: p.title, slug: p.slug })),
    at: now,
  };
  return text;
}

// اگر مدل اسم محصول را بدون لینک آورد، سمت سرور لینک‌دارش می‌کنیم
// (مدل‌های رایگان همیشه فرمت [نام](/product/slug) را رعایت نمی‌کنند)
function linkifyReply(reply) {
  // آدرس مطلق (https://دامنه/product/...) → مسیر نسبی، تا یکدست پردازش شود
  reply = reply.replace(/https?:\/\/[^\s<>()\]"']*\/product\//g, "/product/");

  for (const p of catalogCache.items) {
    if (!p.title || !p.slug) continue;
    const link = `/product/${p.slug}`;

    // الگوی «نام محصول (/product/slug)» که بعضی مدل‌ها می‌سازند → مارک‌داون
    const plain = `${p.title} (${link})`;
    if (reply.includes(plain)) {
      reply = reply.split(plain).join(`[${p.title}](${link})`);
      continue;
    }

    if (reply.includes(`(${link})`)) continue; // قبلاً لینک شده
    const idx = reply.indexOf(p.title);
    if (idx === -1) continue;
    if (reply[idx - 1] === "[") continue; // داخل براکتِ لینک است
    reply =
      reply.slice(0, idx) +
      `[${p.title}](${link})` +
      reply.slice(idx + p.title.length);
  }
  return reply;
}

class consultController extends controller {
  // صفحه‌ی مشاوره
  async page(req, res, next) {
    try {
      const siteUrl = `${req.protocol}://${req.get("host")}`;
      return res.render("shop/consult", {
        pageTitle: "مشاوره رایگان مکمل با هوش مصنوعی",
        metaDescription:
          "مشاوره رایگان و آنلاین مکمل‌های ورزشی با هوش مصنوعی؛ بپرسید چه مکملی برای هدف و شرایط شما مناسب است — پروتئین، کراتین، گینر و بیشتر.",
        canonicalUrl: `${siteUrl}/consult`,
      });
    } catch (err) {
      next(err);
    }
  }

  // API گفتگو
  async ask(req, res, next) {
    try {
      const ip =
        req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      if (rateLimited(String(ip))) {
        return res.status(429).json({
          success: false,
          message:
            "تعداد پیام‌های شما زیاد است؛ لطفاً چند دقیقه بعد دوباره تلاش کنید.",
        });
      }

      if (!apiKey()) {
        return res.status(503).json({
          success: false,
          message:
            "سرویس مشاوره هنوز فعال نشده است. (مدیر سایت باید AI_API_KEY را در تنظیمات قرار دهد)",
        });
      }

      // اعتبارسنجی ورودی: آرایه‌ی پیام‌ها با نقش و متن محدود
      let { messages } = req.body || {};
      if (!Array.isArray(messages)) messages = [];
      messages = messages
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0,
        )
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

      if (!messages.length || messages[messages.length - 1].role !== "user") {
        return res
          .status(400)
          .json({ success: false, message: "پیامی ارسال نشده است." });
      }

      const catalog = await getCatalogText().catch(() => "");

      const system = [
        "تو «مشاور فیت‌ریکس» هستی؛ مشاور مکمل ورزشی و تغذیه‌ی ورزشی فروشگاه فیت ریکس شاپ.",
        "لحن: گرم، صمیمی و خودمونی — محاوره‌ای بنویس («بگو هدفت چیه» به‌جای «بفرمایید هدف‌تان چیست»). گاهی ایموجی مناسب 💪",
        "قوانین:",
        "1) فقط در اولین پیام گفتگو سلام کن. در پیام‌های بعدی هرگز سلام و خوش‌آمدگویی را تکرار نکن — مستقیم برو سر جواب.",
        "2) جریان مشاوره: همین که هدف کاربر مشخص شد (عضله‌سازی، کاهش وزن، انرژی...)، در همان پاسخ ۳ تا ۵ محصول مناسب از فهرست معرفی کن — پیشنهاد را هیچ‌وقت به گرفتن اطلاعات موکول نکن. بعد از معرفی، در انتهای هر پیام یک سوال هوشمند برای دقیق‌تر کردن انتخاب بپرس: بودجه‌اش چقدر است؟ افزایش وزن می‌خواهد یا عضله‌ی خالص؟ پودر راحت‌تر است یا کپسول؟ طعم خاصی دوست دارد؟ کافئین برایش مشکلی ندارد؟ — در هر پیام فقط یک سوال، و با جواب کاربر پیشنهاد را دقیق‌تر کن.",
        "3) وقتی کاربر «بیشتر»، «بهتر» یا «گزینه‌ی دیگر» خواست، محصولات جدید و معرفی‌نشده از فهرست بده و همان فهرست قبلی را عیناً تکرار نکن (کل فهرست را در نظر بگیر، نه فقط موارد اولش). اگر محصول مرتبط جدیدی نمانده بود، گفتگو را بن‌بست نکن — به‌جایش کمکش کن انتخاب کند: با توجه به شرایطش بهترین گزینه از بین معرفی‌شده‌ها را پیشنهاد بده و مقایسه‌شان کن (اینجا اشاره‌ی دوباره به محصول قبلی با لینک اشکالی ندارد)، نحوه‌ی مصرف و ترکیب کردن‌شان (استک) را توضیح بده، یا نکته‌ی تغذیه و تمرین بگو.",
        "4) پیشنهاد فقط از «فهرست محصولات» پایین. هر بار نام محصولی را می‌آوری، بلافاصله لینکش را با فرمت [نام محصول](/product/slug) از همان فهرست بیاور — پاسخ بدون لینک ناقص است. هرگز محصول، قیمت یا لینکی از خودت نساز؛ اگر محصول مناسبی نبود صادقانه بگو موجود نیست.",
        "5) از جدول استفاده نکن. محصولات را به‌صورت فهرست ساده بنویس: هر محصول در یک خط، با یک توضیح کوتاه.",
        "6) به سلام و تشکر گرم و کوتاه جواب بده. سوال کاملاً بی‌ربط (سیاست، برنامه‌نویسی...) را دوستانه رد کن: «راستش من فقط توی مکمل و تغذیه ورزشی می‌تونم کمکت کنم 😅 بگو هدف تمرینیت چیه تا یه پیشنهاد خوب بهت بدم!»",
        "7) توصیه‌ی پزشکی نده. فقط اگر کاربر از بیماری، دارو، بارداری یا سن زیر ۱۸ گفت، با یک جمله‌ی مهربان به پزشک ارجاع بده.",
        "قیمت‌ها به تومان است.",
        "",
        "فهرست محصولات (نام | دسته | قیمت | لینک):",
        catalog || "(فهرست در دسترس نیست — هیچ محصولی پیشنهاد نده)",
      ].join("\n");

      // تلاش به‌ترتیب: اول مدل‌های .env، بعد مدل‌های رایگانِ کشف‌شده‌ی زنده
      const discovered = await discoverFreeModels();
      const candidates = [...new Set([...AI_MODELS, ...discovered])];

      let response = null;
      let usedModel = AI_MODEL;
      for (const model of candidates) {
        usedModel = model;
        response = await fetch(AI_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey()}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: system }, ...messages],
            max_tokens: 700,
            temperature: 0.4,
          }),
        });
        if (response.ok) break;
        // خطای کلید/دسترسی با مدل بعدی حل نمی‌شود — بی‌جهت تکرار نکن
        if (response.status === 401 || response.status === 403) break;
        console.error(
          `AI model failed (${response.status}): ${model} — trying next`,
        );
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(
          "AI API error:",
          response.status,
          "url:",
          AI_API_URL,
          "model:",
          usedModel,
          errText.slice(0, 300),
        );
        const byStatus = {
          401: "کلید سرویس هوش مصنوعی نامعتبر است — AI_API_KEY را در .env بررسی کنید.",
          402: "اعتبار حساب سرویس هوش مصنوعی تمام شده است.",
          403: "دسترسی به سرویس هوش مصنوعی مسدود است (محدودیت یا تحریم) — آدرس سرویس را بررسی کنید.",
          404: "آدرس یا نام مدل اشتباه است — AI_API_URL و AI_MODEL را بررسی کنید.",
          429: "سرویس هوش مصنوعی شلوغ است؛ چند لحظه بعد دوباره تلاش کنید.",
        };
        // ۴۲۹ دو معنی دارد: شلوغی موقت، یا تمام شدن اعتبار حساب
        let message = byStatus[response.status];
        if (response.status === 429 && errText.includes("insufficient_quota")) {
          message =
            "اعتبار حساب سرویس هوش مصنوعی تمام شده است — حساب باید شارژ شود.";
        }
        return res.status(502).json({
          success: false,
          message:
            message ||
            "ارتباط با سرویس هوش مصنوعی برقرار نشد؛ لطفاً بعداً تلاش کنید.",
        });
      }

      const data = await response.json();
      let reply =
        data?.choices?.[0]?.message?.content?.trim() ||
        "متاسفانه پاسخی دریافت نشد؛ دوباره تلاش کنید.";
      reply = linkifyReply(reply);

      return res.json({ success: true, reply });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new consultController();
