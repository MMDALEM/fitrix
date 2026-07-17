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
// اصلاحِ کالری بر اساس تیپ بدنی: اکتومورف کمی بیشتر، اندومورف کمی کمتر
const BODY_CAL = { ecto: 1.05, meso: 1.0, endo: 0.95 };

// BMR (Mifflin-St Jeor) + TDEE + کالریِ هدف + ماکروهایِ شخصی‌سازی‌شده + BMI
// ماکروها بر اساسِ هدف، تیپ بدنی و سطحِ تجربه تنظیم می‌شوند تا دو نفر با
// شرایطِ متفاوت اعدادِ متفاوت بگیرند (نه یک عددِ ثابت).
function computeMetrics(p) {
  const w = Number(p.weight), h = Number(p.height), a = Number(p.age);
  const bmrBase = 10 * w + 6.25 * h - 5 * a;
  const bmr = Math.round(p.gender === "female" ? bmrBase - 161 : bmrBase + 5);
  const tdee = Math.round(bmr * (ACTIVITY[p.activity] || 1.55));
  const bodyAdj = BODY_CAL[p.bodyType] ?? 1.0;
  const calories = Math.round((tdee * (GOAL_FACTOR[p.goal] ?? 1.0) * bodyAdj) / 10) * 10;

  // پروتئین: چربی‌سوزی و پیشرفته‌ها بالاتر (حفظِ عضله)؛ اندومورف کمی بیشتر (سیری)
  let proteinPerKg = p.goal === "fatloss" ? 2.2 : (p.goal === "muscle" || p.goal === "strength") ? 2.0 : 1.8;
  if (p.bodyType === "endo") proteinPerKg += 0.1;
  if (p.experience === "advanced") proteinPerKg += 0.1;
  const protein = Math.round(w * Math.min(proteinPerKg, 2.6));

  // چربی: اندومورف نسبتِ چربیِ بالاتر/کربِ کمتر؛ اکتومورف برعکس
  const fatPerKg = p.bodyType === "endo" ? 1.0 : p.bodyType === "ecto" ? 0.8 : 0.9;
  const fat = Math.round(w * fatPerKg);

  const carb = Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 0);
  const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
  return { bmr, tdee, calories, protein, carb, fat, bmi };
}

// اسپلیتِ پیشنهادیِ سمتِ سرور — بر اساسِ تعدادِ روز، سطح و هدف.
// این «اسکلتِ ساختار» به مدل داده می‌شود تا برنامه‌ها یک‌شکل نشوند و ساختارشان
// واقعاً با شرایطِ فرد بخواند (به‌جای اینکه مدل هر بار یک الگوی تکراری بسازد).
function recommendSplit(days, experience, goal) {
  const d = Math.min(Math.max(Number(days) || 3, 1), 7);
  const beginner = experience === "beginner";
  const plans = {
    1: ["تمامِ بدن (فول‌بادی)"],
    2: ["بالاتنه", "پایین‌تنه"],
    3: beginner
      ? ["فول‌بادی A", "فول‌بادی B", "فول‌بادی C"]
      : ["سینه/شانه/پشت‌بازو (Push)", "پشت/جلوبازو (Pull)", "پا و شکم (Legs)"],
    4: ["بالاتنه (قدرت)", "پایین‌تنه (قدرت)", "بالاتنه (حجم)", "پایین‌تنه (حجم)"],
    5: beginner
      ? ["بالاتنه", "پایین‌تنه", "فول‌بادی", "بالاتنه", "پایین‌تنه"]
      : ["سینه", "پشت", "پا", "شانه و بازو", "فول‌بادی/رفعِ ضعف"],
    6: ["Push (سینه/شانه/پشت‌بازو)", "Pull (پشت/جلوبازو)", "Legs (پا)", "Push", "Pull", "Legs"],
    7: ["Push", "Pull", "Legs", "بالاتنه", "پایین‌تنه", "فول‌بادی/رفعِ ضعف", "کاردیوی سبک و ریکاوری"],
  };
  let split = (plans[d] || plans[3]).slice();
  // برای استقامت/تناسبِ عمومی، روزِ آخر را کاردیو/متابولیک کن
  if ((goal === "endurance" || goal === "fitness") && d >= 4) {
    split[split.length - 1] = "کاردیو و متابولیک (HIIT/دایره‌ای)";
  }
  return split;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AI_FETCH_TIMEOUT_MS = 45000;
async function fetchAI(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// فراخوانیِ AI با fallbackِ چندمدلی + retry. خروجیِ JSON را برمی‌گرداند.
// validate: تابعِ اعتبارسنجیِ خروجی (پیش‌فرض: وجودِ weeklyPlan).
async function callAIJson({ system, user, maxTokens, validate }) {
  const isValid = validate || ((p) => p && Array.isArray(p.weeklyPlan));
  let lastErr = null;
  for (const model of PROGRAM_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchAI(AI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            max_tokens: maxTokens,
            temperature: 0.6,
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
        if (isValid(parsed)) return parsed;
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

// ── تولیدِ برنامه‌ی کامل: تمرین + تغذیه + مکمل ──
// برای «قطعی» بودنِ هر سه بخش، تولید به دو فراخوانیِ AIِ جدا شکسته می‌شود تا
// هیچ‌کدام به‌خاطرِ محدودیتِ توکن قیچی نشوند: (۱) تمرینِ حجیم، (۲) تغذیه+مکملِ
// سبک‌تر. برای هر بخش هم fallbackِ مطمئن گذاشته شده تا حتی در بدترین حالت خالی نماند.
async function generateProgram({ intake, metrics }) {
  const catalog = await getCatalogText().catch(() => "");
  const split = recommendSplit(intake.daysPerWeek, intake.experience, intake.goal);
  const splitText = split.map((s, i) => `روز ${i + 1}: ${s}`).join(" | ");
  const profile = profileText(intake, metrics);

  // دو فراخوانی به‌صورتِ موازی (سرعتِ بیشتر)؛ شکستِ یکی دیگری را خراب نمی‌کند
  const [workout, nutri] = await Promise.all([
    generateWorkout({ intake, splitText, profile }).catch(() => null),
    generateNutritionAndSupps({ intake, metrics, catalog, profile }).catch(() => null),
  ]);

  const weeklyPlan =
    workout && Array.isArray(workout.weeklyPlan) ? workout.weeklyPlan : [];
  // اگر برنامه‌ی تمرین کاملاً شکست خورد، کلِ تولید ناموفق است (صفحه‌ی failed)
  if (!weeklyPlan.length) throw new Error("تولیدِ برنامه‌ی تمرین ناموفق بود");

  const out = {
    title: (workout && workout.title) || "برنامه‌ی اختصاصیِ من",
    summary: (workout && workout.summary) || "",
    weeklyPlan,
    nutrition:
      nutri && nutri.nutrition && Array.isArray(nutri.nutrition.meals) && nutri.nutrition.meals.length
        ? nutri.nutrition
        : buildFallbackNutrition(intake, metrics),
    supplements: [],
  };

  // مکمل: از خروجیِ تغذیه؛ اگر نبود فراخوانیِ کوچکِ جداگانه؛ اگر باز هم نبود پیش‌فرض
  let supps = nutri && Array.isArray(nutri.supplements) ? nutri.supplements : [];
  if (!supps.length)
    supps = await generateSupplements({ intake, metrics, catalog, profile }).catch(() => []);
  if (!supps.length) supps = defaultSupplements(intake.goal);
  out.supplements = await mapSupplements(supps);

  return out;
}

// ── فراخوانیِ ۱: برنامه‌ی تمرین ──
async function generateWorkout({ intake, splitText, profile }) {
  const system = [
    "تو یک مربیِ بدنسازیِ باتجربه در سطحِ حرفه‌ای هستی. یک برنامه‌ی تمرینیِ کاملاً *اختصاصی* برای همین فردِ مشخص طراحی کن؛ نه یک برنامه‌ی عمومی و کلیشه‌ای.",
    "برنامه باید با تک‌تکِ ورودی‌ها بخواند: جنسیت، سن، قد/وزن/BMI، تیپ بدنی، هدف، سطحِ تجربه، تعدادِ روز، محلِ تمرین (تجهیزات) و آسیب‌ها. دو نفر با شرایطِ متفاوت نباید برنامه‌ی مشابه بگیرند.",
    "خروجی فقط یک شیء JSON معتبر و بدونِ متنِ اضافه با این ساختار:",
    `{"title":"...","summary":"۳-۴ جمله‌ی شخصی درباره‌ی وضعیت و هدفِ همین فرد","weeklyPlan":[{"day":"روز ۱ - نام گروهِ عضلانی","focus":"عضلاتِ درگیر","exercises":[{"name":"نام دقیقِ حرکت","sets":"۴","reps":"۸-۱۲","rest":"۹۰ ثانیه","note":"فرمِ صحیح + تمپو + شدت (RIR/RPE) + یک اشتباهِ رایج"}]}]}`,
    `تعدادِ روز باید دقیقاً ${intake.daysPerWeek} روز باشد. از این اسکلتِ اسپلیت که برای سطح و هدفِ همین فرد انتخاب شده استفاده کن: ${splitText}`,
    "برای هر روز یک حرکتِ گرم‌کردن + ۵ تا ۷ حرکتِ اصلی. حجم و شدت را با سطح تنظیم کن: مبتدی ۲-۳ ست و تمرکز روی فرم؛ متوسط ۳-۴ ست؛ پیشرفته ۴-۵ ست + یک تکنیکِ شدت در حرکاتِ ایمن.",
    "حرکات دقیقاً با تجهیزاتِ محلِ تمرین بخوانند: باشگاه → دستگاه + وزنه‌ی آزاد؛ خانه → دمبل/کش/وزنِ بدن؛ بدونِ تجهیزات → فقط وزنِ بدن. حرکتی که تجهیزاتش نیست ننویس.",
    intake.injuries ? `‼️ آسیب/محدودیت: «${intake.injuries}». حرکاتِ پرفشار روی این ناحیه را حذف یا با جایگزینِ ایمن عوض کن و در note هشدار بده.` : "",
    "تیپ بدنی را اعمال کن: اکتومورف → ترکیبیِ سنگین و استراحتِ بیشتر؛ اندومورف → تراکمِ بالاتر و استراحتِ کوتاه‌تر؛ مزومورف → متعادل.",
    "همه‌ی متن‌ها فارسیِ روان و حرفه‌ای، اعداد فارسی، بدونِ ایموجی.",
  ].filter(Boolean).join("\n");
  const user = "مشخصاتِ کاربر:\n" + profile + "\n\nحالا فقط برنامه‌ی تمرین را کامل و دقیق طراحی کن.";
  return callAIJson({
    system,
    user,
    maxTokens: 3500,
    validate: (p) => p && Array.isArray(p.weeklyPlan) && p.weeklyPlan.length > 0,
  });
}

// ── فراخوانیِ ۲: تغذیه + مکمل ──
async function generateNutritionAndSupps({ intake, metrics, catalog, profile }) {
  const system = [
    "تو متخصصِ تغذیه‌ی ورزشی و مکمل هستی. برای همین فردِ مشخص یک برنامه‌ی تغذیه‌ی کامل و فهرستِ مکملِ مناسب طراحی کن.",
    "خروجی فقط یک شیء JSON معتبر و بدونِ متنِ اضافه با این ساختار:",
    `{"nutrition":{"overview":"استراتژی + کالریِ کلِ روزانه","meals":[{"name":"صبحانه","items":["ماده با مقدارِ دقیق"],"calories":"حدود ۵۵۰ کیلوکالری","note":"..."}],"tips":["..."]},"supplements":[{"query":"پروتئین وی","reason":"چرا برای همین فرد","dose":"۱ اسکوپ (۳۰ گرم)","timing":"بعد از تمرین","priority":"ضروری"}]}`,
    `کالریِ هدف ${metrics.calories} کیلوکالری و ماکرو: پروتئین ${metrics.protein}g، کربوهیدرات ${metrics.carb}g، چربی ${metrics.fat}g. overview این اعداد و استراتژی (کات/بالک/ریکامپ) را توضیح دهد.`,
    "دقیقاً ۵ تا ۶ وعده بده (صبحانه، میان‌وعده، ناهار، قبل/بعدِ تمرین، شام). هر وعده موادِ غذایی با مقدارِ دقیق (گرم/عدد/لیوان) + فیلدِ calories + note. مجموعِ کالریِ وعده‌ها نزدیکِ کالریِ هدف (خطای کمتر از ۱۰٪).",
    intake.diet ? `‼️ محدودیتِ غذایی: «${intake.diet}». هیچ ماده‌ی مغایری نیاور و جایگزینِ مناسب بده.` : "",
    "غذاها واقعی، در دسترسِ ایران و مقرون‌به‌صرفه. tips دستِ‌کم ۴ نکته (آب، خواب، زمان‌بندیِ وعده‌ها، پیشرفتِ تدریجی).",
    "برای supplements فقط نامِ عمومی (پروتئین وی، کراتین، گینر، بی‌سی‌ای‌ای، مولتی‌ویتامین، امگا۳، گلوتامین، ال‌کارنیتین). ۳ تا ۵ قلم، اول اقلامِ ضروری، هر کدام با dose و timing و priority (ضروری/مکمل/اختیاری).",
    intake.budget ? `بودجه‌ی مکمل حدود ${Number(intake.budget).toLocaleString("fa-IR")} تومان در ماه؛ فراتر نرو.` : "بودجه مشخص نیست؛ فقط اقلامِ پایه و ضروری.",
    "همه‌ی متن‌ها فارسیِ روان و حرفه‌ای، اعداد فارسی، بدونِ ایموجی.",
    catalog ? "برای مکمل ترجیحاً از این محصولاتِ موجود انتخاب کن:\n" + catalog : "",
  ].filter(Boolean).join("\n");
  const user = "مشخصاتِ کاربر:\n" + profile + "\n\nحالا برنامه‌ی تغذیه و مکملِ مناسب را کامل بده.";
  return callAIJson({
    system,
    user,
    maxTokens: 2800,
    validate: (p) => p && p.nutrition && Array.isArray(p.nutrition.meals),
  });
}

// ── فراخوانیِ کوچکِ مستقل فقط برای مکمل (fallback وقتی تماسِ تغذیه مکمل نداد) ──
async function generateSupplements({ intake, catalog, profile }) {
  const system = [
    "تو متخصصِ مکملِ ورزشی هستی. ۳ تا ۵ مکملِ مناسبِ همین فرد را پیشنهاد بده.",
    `خروجی فقط یک شیء JSON: {"supplements":[{"query":"نامِ عمومی","reason":"چرا برای این فرد","dose":"مقدار","timing":"زمانِ مصرف","priority":"ضروری|مکمل|اختیاری"}]}`,
    "فقط نامِ عمومی (پروتئین وی، کراتین، گینر، بی‌سی‌ای‌ای، مولتی‌ویتامین، امگا۳، گلوتامین، ال‌کارنیتین). اول ضروری‌ها. فارسی، بدونِ ایموجی.",
    intake.budget ? `بودجه حدود ${Number(intake.budget).toLocaleString("fa-IR")} تومان در ماه.` : "",
    catalog ? "ترجیحاً از این محصولاتِ موجود:\n" + catalog : "",
  ].filter(Boolean).join("\n");
  const user = "مشخصات:\n" + profile + "\n\nمکمل‌های مناسب را بده.";
  const parsed = await callAIJson({
    system,
    user,
    maxTokens: 700,
    validate: (p) => p && Array.isArray(p.supplements),
  });
  return Array.isArray(parsed.supplements) ? parsed.supplements : [];
}

// پیشنهادِ مکملِ پیش‌فرضِ متناسب با هدف — اگر AI هیچ مکملی نداد، همیشه چیزی نشان داده شود
function defaultSupplements(goal) {
  const list = [
    { query: "پروتئین وی", reason: "تأمینِ پروتئینِ روزانه برای حفظ و رشدِ عضله", dose: "۱ اسکوپ (۳۰ گرم)", timing: "بعد از تمرین", priority: "ضروری" },
    { query: "مولتی ویتامین", reason: "پوششِ ریزمغذی‌ها و سلامتِ عمومی", dose: "۱ عدد", timing: "همراهِ صبحانه", priority: "مکمل" },
  ];
  if (goal === "muscle" || goal === "strength" || goal === "recomp")
    list.splice(1, 0, { query: "کراتین", reason: "افزایشِ قدرت و حجمِ عضلانی", dose: "۵ گرم", timing: "روزانه (هر زمان)", priority: "ضروری" });
  if (goal === "muscle")
    list.push({ query: "گینر", reason: "کمک به دریافتِ کالریِ مازاد برای افزایشِ وزن", dose: "۱ وعده", timing: "بین وعده‌ها", priority: "اختیاری" });
  if (goal === "fatloss")
    list.push({ query: "ال کارنیتین", reason: "کمک به سوخت‌وسازِ چربی همراهِ رژیم و تمرین", dose: "۱۵۰۰ میلی‌گرم", timing: "قبل از تمرین", priority: "اختیاری" });
  return list;
}

// تغذیه‌ی پیش‌فرضِ محاسباتی (اگر فراخوانیِ تغذیه شکست خورد) — بر اساسِ ماکروهای همین فرد
function buildFallbackNutrition(intake, metrics) {
  const c = metrics.calories || 2200;
  const fa = (n) => Number(n).toLocaleString("fa-IR");
  const meals = [
    { name: "صبحانه", pct: 0.22, items: ["۳ عدد تخم‌مرغ", "۵۰ گرم جو دوسر", "۱ عدد میوه"] },
    { name: "میان‌وعده", pct: 0.13, items: ["۳۰ گرم مغزها (بادام/گردو)", "۱ عدد میوه"] },
    { name: "ناهار", pct: 0.28, items: ["۱۵۰ گرم منبعِ پروتئین (مرغ/گوشت/ماهی)", "۱ لیوان برنج یا نان", "سالاد و سبزیجات"] },
    { name: "قبل/بعد تمرین", pct: 0.15, items: ["۱ عدد موز", "منبعِ پروتئین (وی یا تخم‌مرغ)"] },
    { name: "شام", pct: 0.22, items: ["۱۲۰ گرم منبعِ پروتئین", "سبزیجات", "منبعِ کربوهیدراتِ سبک"] },
  ];
  return {
    overview: `کالریِ هدفِ روزانه حدود ${fa(c)} کیلوکالری با پروتئین ${fa(metrics.protein)} گرم، کربوهیدرات ${fa(metrics.carb)} گرم و چربی ${fa(metrics.fat)} گرم. وعده‌ها را منظم و با فاصله‌ی مناسب مصرف کن.`,
    meals: meals.map((m) => ({
      name: m.name,
      items: m.items,
      calories: `حدود ${fa(Math.round((c * m.pct) / 10) * 10)} کیلوکالری`,
      note: "",
    })),
    tips: [
      "روزانه ۲.۵ تا ۳.۵ لیتر آب بنوش.",
      "۷ تا ۸ ساعت خوابِ باکیفیت داشته باش.",
      "پروتئین را در طولِ روز پخش کن (هر وعده منبعِ پروتئین داشته باشد).",
      "هر ۱ تا ۲ هفته وزن و آینه را بررسی و در صورتِ نیاز کالری را تنظیم کن.",
    ],
  };
}

async function mapSupplements(list) {
  const result = [];
  const seen = new Set();
  for (const s of list.slice(0, 8)) {
    const q = String(s.query || s.title || "").trim();
    if (!q) continue;

    // اطلاعاتِ کاربردیِ مکمل (مقدار/زمان/اولویت) از خروجیِ مدل
    const extra = {
      reason: String(s.reason || "").slice(0, 220),
      dose: String(s.dose || "").slice(0, 80),
      timing: String(s.timing || "").slice(0, 80),
      priority: String(s.priority || "").slice(0, 30),
    };

    const words = q.split(/\s+/).slice(0, 3).map(escapeRe).join("|");
    const prod = await productModel
      .findOne({ isActive: true, siteHidden: { $ne: true }, quantity: { $gt: 0 }, title: { $regex: words, $options: "i" } })
      .sort({ soldCount: -1 })
      .select("title slug")
      .lean()
      .catch(() => null);

    if (prod) {
      if (seen.has(prod.slug)) continue;
      seen.add(prod.slug);
      result.push({ title: prod.title, slug: prod.slug, ...extra });
    } else {
      // مکملِ پیشنهادی که در فروشگاه موجود نیست: باز هم در برنامه نمایش داده
      // می‌شود (بدونِ لینکِ خرید) تا مشاوره کامل بماند
      const key = "x:" + q;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ title: q, slug: "", ...extra });
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
      const res = await fetchAI(AI_API_URL, {
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
