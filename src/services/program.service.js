// ───────────────────────────────────────────────────────────────
// سرویسِ برنامه‌سازِ هوشمند (ورزشی + تغذیه)
// - محاسبه‌ی BMR/TDEE/کالری/ماکرو «سمت سرور با فرمول» (دقتِ بالا، توکنِ کم).
// - تولیدِ برنامه با AI به‌صورتِ JSON ساختارمند و پرجزئیات.
// - مقاوم در برابر خطا: چند مدل به‌ترتیب امتحان می‌شوند و هر کدام چند بار retry.
// .env:
//   AI_API_URL   endpoint سازگار با OpenAI
//   AI_API_KEY   کلید
//   AI_PROGRAM_MODEL  یک یا چند مدل (با ویرگول) برای تولیدِ برنامه (fallback)
//   AI_MODEL     مدلِ مشاوره (اینجا هم به‌عنوان fallback نهایی استفاده می‌شود)
// ───────────────────────────────────────────────────────────────
const productModel = require("../models/product.model");

function normalizeUrl(raw) {
  let url = String(raw || "").trim().replace(/^["']|["']$/g, "");
  if (!url) return "https://openrouter.ai/api/v1/chat/completions";
  if (!/\/chat\/completions\/?$/.test(url)) url = url.replace(/\/+$/, "") + "/chat/completions";
  return url;
}
const AI_API_URL = normalizeUrl(process.env.AI_API_URL);
const apiKey = () => (process.env.AI_API_KEY || "").trim().replace(/^["']|["']$/g, "");

function parseModels(raw, fallback) {
  const list = String(raw || "").replace(/["']/g, "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
}
// مدل‌های تولیدِ برنامه (به‌ترتیبِ اولویت). اگر ست نشده باشد از AI_MODEL استفاده می‌کند.
const PROGRAM_MODELS = parseModels(
  process.env.AI_PROGRAM_MODEL,
  parseModels(process.env.AI_MODEL, ["deepseek/deepseek-chat-v3.1"]),
);

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 };
const GOAL_FACTOR = { fatloss: 0.8, muscle: 1.1, recomp: 1.0, strength: 1.05, endurance: 1.0, fitness: 1.0 };

// BMR (Mifflin-St Jeor) + TDEE + کالریِ هدف + ماکروها + BMI
function computeMetrics(p) {
  const w = Number(p.weight), h = Number(p.height), a = Number(p.age);
  const bmrBase = 10 * w + 6.25 * h - 5 * a;
  const bmr = Math.round(p.gender === "female" ? bmrBase - 161 : bmrBase + 5);
  const tdee = Math.round(bmr * (ACTIVITY[p.activity] || 1.55));
  const calories = Math.round((tdee * (GOAL_FACTOR[p.goal] ?? 1.0)) / 10) * 10;
  const proteinPerKg = p.goal === "fatloss" ? 2.2 : (p.goal === "muscle" || p.goal === "strength") ? 2.0 : 1.8;
  const protein = Math.round(w * proteinPerKg);
  const fat = Math.round(w * 0.9);
  const carb = Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 0);
  const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
  return { bmr, tdee, calories, protein, carb, fat, bmi };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// فراخوانیِ AI با fallbackِ چندمدلی + retry. خروجیِ JSON را برمی‌گرداند.
async function callAIJson({ system, user, maxTokens }) {
  let lastErr = null;
  for (const model of PROGRAM_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(AI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            max_tokens: maxTokens,
            temperature: 0.5,
            response_format: { type: "json_object" },
          }),
        });
        if (!res.ok) {
          // 401/403 با مدلِ دیگر هم حل نمی‌شود → توقفِ همان مدل
          if (res.status === 401 || res.status === 403) { lastErr = new Error("AI auth " + res.status); break; }
          lastErr = new Error("AI " + res.status);
          await sleep(600 * (attempt + 1));
          continue;
        }
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content?.trim() || "";
        const parsed = parseJsonLoose(raw);
        if (parsed && Array.isArray(parsed.weeklyPlan)) return parsed;
        lastErr = new Error("پاسخِ نامعتبر");
      } catch (e) {
        lastErr = e;
        await sleep(600 * (attempt + 1));
      }
    }
  }
  throw lastErr || new Error("تولیدِ برنامه ناموفق بود");
}

function parseJsonLoose(raw) {
  if (!raw) return null;
  let s = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(s); } catch {}
  const i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i !== -1 && j !== -1 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch {} }
  return null;
}

const GOAL_FA = { muscle: "عضله‌سازی", fatloss: "کاهش وزن/چربی‌سوزی", recomp: "بازترکیب بدن", strength: "افزایش قدرت", endurance: "استقامت", fitness: "تناسب اندام عمومی" };
const PLACE_FA = { gym: "باشگاه با دستگاه کامل", home: "خانه با دمبل/کش", none: "بدون تجهیزات (وزن بدن)" };
const EXP_FA = { beginner: "مبتدی", intermediate: "متوسط", advanced: "پیشرفته" };
const BODY_FA = { ecto: "اکتومورف (لاغر، سوخت‌وسازِ سریع)", meso: "مزومورف (عضلانی، پاسخ‌ده)", endo: "اندومورف (مستعدِ افزایشِ چربی)" };

function profileText(p, m) {
  return [
    `جنسیت: ${p.gender === "female" ? "خانم" : "آقا"}`,
    `سن: ${p.age} | قد: ${p.height}cm | وزن: ${p.weight}kg | BMI: ${m.bmi}`,
    p.bodyType && BODY_FA[p.bodyType] ? `تیپ بدنی: ${BODY_FA[p.bodyType]}` : "",
    `هدف: ${GOAL_FA[p.goal] || p.goal}`,
    `سطح: ${EXP_FA[p.experience] || p.experience} | روزهای تمرین: ${p.daysPerWeek} روز در هفته`,
    `محل تمرین: ${PLACE_FA[p.place] || p.place}`,
    p.injuries ? `آسیب/محدودیت: ${p.injuries}` : "",
    p.diet ? `محدودیت غذایی: ${p.diet}` : "",
    `کالریِ هدفِ روزانه: ${m.calories} kcal | ماکرو: پروتئین ${m.protein}g، کربوهیدرات ${m.carb}g، چربی ${m.fat}g`,
    p.budget ? `بودجه‌ی مکمل: حدود ${Number(p.budget).toLocaleString("fa-IR")} تومان در ماه` : "",
  ].filter(Boolean).join("\n");
}

// تولیدِ برنامه‌ی کاملِ پرجزئیات (همیشه کامل ساخته می‌شود؛ نمایشِ محدود سمتِ سرور)
async function generateProgram({ intake, metrics }) {
  const catalog = await getCatalogText().catch(() => "");

  const system = [
    "تو یک مربیِ بدنسازی و متخصصِ تغذیه‌ی ورزشیِ حرفه‌ای و باتجربه هستی. یک برنامه‌ی بسیار دقیق، اصولی، علمی و کاملاً شخصی‌سازی‌شده طراحی کن.",
    "خروجی را فقط و فقط یک شیء JSON معتبر و بدونِ هیچ متنِ اضافه بده، دقیقاً با این ساختار:",
    `{"title":"...", "summary":"۲-۳ خط انگیزشی و شخصی", "weeklyPlan":[ {"day":"روز ۱ - نام گروه عضلانی","focus":"عضلاتِ درگیر","exercises":[ {"name":"نام دقیق حرکت","sets":"۴","reps":"۸-۱۲","rest":"۹۰ ثانیه","note":"نکته‌ی فرم/تکنیک"} ] } ], "nutrition":{"overview":"توضیحِ کوتاه + کالریِ کلِ روزانه","meals":[ {"name":"صبحانه","items":["ماده غذایی با مقدار"],"calories":"حدود ۵۵۰ کیلوکالری","note":"..."} ],"tips":["..."]}, "supplements":[ {"query":"پروتئین وی","reason":"چرا برای این فرد"} ] }`,
    "قوانینِ دقت و کیفیت:",
    "- summary باید ۳ تا ۴ جمله باشد: وضعیتِ فعلیِ فرد، منطقِ برنامه و انتظارِ نتیجه.",
    `- تعداد روزهای weeklyPlan دقیقاً ${intake.daysPerWeek} روز و اسپلیت متناسب با هدف، سطح و تیپ بدنیِ فرد باشد.`,
    "- برای هر روز ۶ تا ۸ حرکت بده. note هر حرکت کامل باشد: نکته‌ی فرمِ صحیح + تمپو/ریتم + یک اشتباهِ رایج که باید از آن پرهیز کرد. حرکات با محل تمرین و آسیب‌های فرد سازگار باشند.",
    "- تیپ بدنی را جدی بگیر: اکتومورف → حجم و کالریِ بالاتر، استراحتِ بیشتر؛ اندومورف → تراکمِ بالاتر و کاردیوی بیشتر؛ مزومورف → متعادل.",
    "- بخشِ تغذیه باید کامل و مفصل باشد: overview شاملِ کالریِ کلِ روزانه و توضیحِ استراتژی؛ سپس **دستِ‌کم ۵ وعده** (صبحانه، میان‌وعده، ناهار، میان‌وعده/قبل تمرین، شام و در صورتِ نیاز بعد تمرین). برای هر وعده مقدارِ دقیقِ مواد (گرم/عدد/لیوان)، فیلدِ calories، و یک note بده. مجموعِ کالریِ وعده‌ها نزدیکِ کالریِ هدف باشد. غذاها واقعی، مقرون‌به‌صرفه و در دسترسِ ایران باشند.",
    "- tips دستِ‌کم ۴ نکته‌ی کاربردیِ تغذیه و ریکاوری (آب، خواب، زمان‌بندیِ وعده‌ها، ...).",
    "- در supplements فقط نامِ عمومیِ مکمل بده (پروتئین وی، کراتین، گینر، بی سی ای ای، مولتی ویتامین، امگا ۳، گلوتامین) و با بودجه‌ی فرد بخوان؛ اول اقلامِ ضروری. برای هر کدام reason ِ کوتاه بنویس.",
    "- همه‌ی متن‌ها فارسیِ روان و حرفه‌ای، اعداد فارسی، بدونِ ایموجی.",
    catalog ? "محصولاتِ موجودِ فروشگاه (query را نزدیک به این‌ها انتخاب کن):\n" + catalog : "",
  ].filter(Boolean).join("\n");

  const user = "مشخصاتِ کاربر:\n" + profileText(intake, metrics) + "\n\nحالا برنامه‌ی کامل و مفصل را طراحی کن.";
  const out = await callAIJson({ system, user, maxTokens: 4000 });

  out.supplements = Array.isArray(out.supplements) ? await mapSupplements(out.supplements) : [];
  return out;
}

async function mapSupplements(list) {
  const result = [];
  const seen = new Set();
  for (const s of list.slice(0, 8)) {
    const q = String(s.query || s.title || "").trim();
    if (!q) continue;
    const words = q.split(/\s+/).slice(0, 3).map(escapeRe).join("|");
    const prod = await productModel
      .findOne({ isActive: true, siteHidden: { $ne: true }, quantity: { $gt: 0 }, title: { $regex: words, $options: "i" } })
      .sort({ soldCount: -1 })
      .select("title slug")
      .lean()
      .catch(() => null);
    if (prod && !seen.has(prod.slug)) {
      seen.add(prod.slug);
      result.push({ title: prod.title, slug: prod.slug, reason: String(s.reason || "").slice(0, 200) });
    }
  }
  return result;
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

let catalogCache = { text: "", at: 0 };
async function getCatalogText() {
  const now = Date.now();
  if (catalogCache.text && now - catalogCache.at < 5 * 60 * 1000) return catalogCache.text;
  const products = await productModel
    .find({ isActive: true, siteHidden: { $ne: true }, quantity: { $gt: 0 } }, "title")
    .populate("category", "title")
    .sort({ category: 1, soldCount: -1 })
    .limit(120)
    .lean();
  catalogCache = { text: products.map((p) => `- ${p.title} | ${p.category?.title || "-"}`).join("\n"), at: now };
  return catalogCache.text;
}

// پرسش‌وپاسخِ پیگیری درباره‌ی همین برنامه
async function askAboutProgram({ plan, question }) {
  const brief = [
    `عنوان: ${plan.title || "-"}`,
    `هدف: ${GOAL_FA[plan.goal] || plan.goal} | کالری: ${plan.metrics?.calories} | پروتئین ${plan.metrics?.protein}g`,
    "روزها: " + (plan.weeklyPlan || []).map((d) => d.day).join(" ، "),
  ].join("\n");
  const system = [
    "تو مربیِ همین کاربر هستی و برنامه‌اش را طراحی کرده‌ای. کوتاه، دقیق و حرفه‌ای جواب بده. فقط درباره‌ی تمرین/تغذیه/مکملِ همین برنامه. توصیه‌ی پزشکی نده. بدونِ ایموجی.",
    "خلاصه‌ی برنامه:\n" + brief,
  ].join("\n");
  let lastErr = null;
  for (const model of PROGRAM_MODELS) {
    try {
      const res = await fetch(AI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, { role: "user", content: String(question).slice(0, 1000) }],
          max_tokens: 500,
          temperature: 0.5,
        }),
      });
      if (!res.ok) { lastErr = new Error("AI " + res.status); if (res.status === 401 || res.status === 403) break; continue; }
      const data = await res.json();
      const t = data?.choices?.[0]?.message?.content?.trim();
      if (t) return t;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("پاسخ‌گویی ناموفق بود");
}

function isConfigured() { return !!apiKey(); }

module.exports = { computeMetrics, generateProgram, askAboutProgram, isConfigured };
