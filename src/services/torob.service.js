// ───────────────────────────────────────────────────────────────
// وبهوکِ ترب (اختیاری) — Product Webhook v1
// هر بار محصولی اضافه یا ویرایش شد، به ترب خبر می‌دهیم تا سریع‌تر همگام
// شود. این کار «کاملاً پس‌زمینه» است و هیچ‌وقت روی پاسخِ کاربر یا nginx
// اثر نمی‌گذارد:
//   • کارِ شبکه روی setImmediate اجرا می‌شود (بعد از ارسالِ پاسخ به کاربر).
//   • هر خطا فقط در کنسول لاگ می‌شود (نه در دیتابیس/تبِ خطاهای پنل) چون
//     شکستِ همگام‌سازیِ ترب یک خطای غیربحرانی است و نباید نویز بسازد.
//
// استفاده (بدون await):
//   const { notifyTorob } = require("../../services/torob.service");
//   notifyTorob([{ page_url, page_unique }]);
//
// .env:
//   TOROB_WEBHOOK_TOKEN  توکنِ Bearer که ترب به فروشگاه می‌دهد
//   (اگر ست نشده باشد، تابع بی‌صدا هیچ کاری نمی‌کند)
// ───────────────────────────────────────────────────────────────
const WEBHOOK_URL = "https://api.torob.com/update/webhook/v1/";
const TIMEOUT_MS = 8000;

function isConfigured() {
  return !!String(process.env.TOROB_WEBHOOK_TOKEN || "").trim();
}

// اطلاع به ترب — همیشه فوری برمی‌گردد و کارِ واقعی را به پس‌زمینه می‌سپارد.
// items: آرایه‌ای از { page_url, page_unique } (حداکثر ۱۰۰ در هر درخواست).
function notifyTorob(items) {
  try {
    if (!isConfigured()) return;
    const list = (Array.isArray(items) ? items : [items])
      .filter((x) => x && x.page_url && x.page_unique)
      .map((x) => ({
        page_url: String(x.page_url),
        page_unique: String(x.page_unique),
      }));
    if (!list.length) return;

    // اجرا بعد از بازگشتِ پاسخ به کاربر؛ خطاها بلعیده می‌شوند تا هرگز به
    // unhandledRejection یا کندیِ درخواست منجر نشوند.
    setImmediate(() => {
      _send(list).catch((e) =>
        console.warn("Torob webhook (نادیده گرفته شد):", e.message),
      );
    });
  } catch (e) {
    console.warn("Torob webhook (نادیده گرفته شد):", e.message);
  }
}

async function _send(list) {
  const token = String(process.env.TOROB_WEBHOOK_TOKEN).trim();
  for (let i = 0; i < list.length; i += 100) {
    await sendChunk(list.slice(i, i + 100), token);
  }
}

async function sendChunk(items, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Torob webhook ${res.status}: ${txt.slice(0, 200)}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { notifyTorob, isConfigured };
