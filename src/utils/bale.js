// ───────────────────────────────────────────────────────────────
// ارسال پیام به پیام‌رسانِ «بله» (Bale) — Bot API (سازگار با تلگرام)
//
// برای اعلانِ سفارش به مدیریت استفاده می‌شود. کاملاً پس‌زمینه و بی‌صدا
// است: هیچ‌وقت پاسخِ کاربر/پرداخت را بلاک نمی‌کند و اگر بله در دسترس
// نبود، فقط در کنسول لاگ می‌شود (نه دیتابیس).
//
// .env:
//   BALE_BOT_TOKEN   توکنِ ربات (از @botfather در بله)
//   BALE_CHAT_ID     شناسه‌ی چت مقصد؛ می‌تواند چند تا با ویرگول باشد:
//                    مثلاً  123456789,987654321  یا آیدیِ گروه (منفی)
//
// نحوه‌ی گرفتنِ chat_id: بعد از اینکه مدیر به ربات /start داد (یا ربات را
// در گروه اضافه کردی)، این آدرس را در مرورگر باز کن و دنبال "chat":{"id":...}
// بگرد:  https://tapi.bale.ai/bot<TOKEN>/getUpdates
// ───────────────────────────────────────────────────────────────
const API_BASE = "https://tapi.bale.ai";
const TIMEOUT_MS = 8000;

function token() {
  return String(process.env.BALE_BOT_TOKEN || "").trim();
}

function chatIds() {
  return String(process.env.BALE_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isConfigured() {
  return !!token() && chatIds().length > 0;
}

// ارسالِ پیام — همیشه فوری برمی‌گردد و کارِ شبکه را به پس‌زمینه می‌سپارد.
function sendBale(text) {
  try {
    if (!isConfigured()) return;
    const message = String(text || "").trim();
    if (!message) return;

    // بعد از بازگشتِ پاسخ به کاربر اجرا می‌شود؛ خطاها بلعیده می‌شوند.
    setImmediate(() => {
      _sendAll(message).catch((e) =>
        console.warn("Bale (نادیده گرفته شد):", e.message),
      );
    });
  } catch (e) {
    console.warn("Bale (نادیده گرفته شد):", e.message);
  }
}

async function _sendAll(text) {
  const tk = token();
  const url = `${API_BASE}/bot${tk}/sendMessage`;
  for (const chat_id of chatIds()) {
    await _post(url, { chat_id, text });
  }
}

async function _post(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Bale ${res.status}: ${txt.slice(0, 200)}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendBale, isConfigured };
