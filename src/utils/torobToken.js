// ───────────────────────────────────────────────────────────────
// اعتبارسنجیِ توکنِ ترب (Torob Product API v3)
// ترب در هر درخواست یک JWT با الگوریتمِ EdDSA (ed25519) در هدرِ
// «X-Torob-Token» می‌فرستد. ما آن را با کلیدِ عمومیِ ترب تأیید می‌کنیم.
//
// کتابخانه‌ی jsonwebtoken از EdDSA پشتیبانی نمی‌کند، اما ماژولِ داخلیِ
// crypto ِ خودِ Node ِ ed25519 را پشتیبانی می‌کند؛ پس بدونِ هیچ پکیجِ
// جدیدی، JWT را دستی پارس و امضایش را با crypto.verify تأیید می‌کنیم.
//
// طبقِ داکیومنت سه ادعا (claim) باید بررسی شوند:
//   exp  → منقضی نشده باشد
//   nbf  → زمانِ فعال‌شدنش رسیده باشد
//   aud  → دقیقاً برابرِ هاستِ همین API باشد (بحرانی برای امنیت)
// ───────────────────────────────────────────────────────────────
const crypto = require("crypto");

// کلیدِ عمومیِ ترب (ed25519) — از torob_api_token_guide.md
const TOROB_PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=\n" +
  "-----END PUBLIC KEY-----";

// اجازه‌ی خطای کوچکِ ساعت بین سرورها (ثانیه)
const CLOCK_SKEW = 60;

let keyObject = null;
function getKey() {
  if (!keyObject) keyObject = crypto.createPublicKey(TOROB_PUBLIC_KEY);
  return keyObject;
}

function b64urlToBuffer(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Buffer.from(s + pad, "base64");
}

// aud ِ موردِ انتظار: هاستِ همین درخواست (شاملِ پورت در صورتِ وجود).
// می‌توان با TOROB_EXPECTED_AUD (یک یا چند مقدار با ویرگول) override کرد.
function expectedAudiences(req) {
  const envAud = String(process.env.TOROB_EXPECTED_AUD || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (envAud.length) return envAud;
  const host = String(req.get("host") || "").toLowerCase();
  return host ? [host] : [];
}

// تأییدِ توکن. در صورتِ معتبر بودن payload را برمی‌گرداند، وگرنه خطا می‌اندازد.
function verifyTorobToken(token, req) {
  if (!token || typeof token !== "string")
    throw new Error("توکن ارسال نشده است");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("ساختارِ توکن نامعتبر است");

  const [headerB64, payloadB64, sigB64] = parts;

  let header, payload;
  try {
    header = JSON.parse(b64urlToBuffer(headerB64).toString("utf8"));
    payload = JSON.parse(b64urlToBuffer(payloadB64).toString("utf8"));
  } catch {
    throw new Error("محتوایِ توکن قابلِ خواندن نیست");
  }

  if (header.alg !== "EdDSA")
    throw new Error("الگوریتمِ توکن پشتیبانی نمی‌شود");

  // تأییدِ امضا روی «header.payload»
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, "ascii");
  const signature = b64urlToBuffer(sigB64);
  const ok = crypto.verify(null, signingInput, getKey(), signature);
  if (!ok) throw new Error("امضایِ توکن معتبر نیست");

  const now = Math.floor(Date.now() / 1000);

  // exp — منقضی نشده باشد
  if (typeof payload.exp === "number" && now > payload.exp + CLOCK_SKEW)
    throw new Error("توکن منقضی شده است");

  // nbf — زمانِ فعال‌شدنش رسیده باشد
  if (typeof payload.nbf === "number" && now + CLOCK_SKEW < payload.nbf)
    throw new Error("توکن هنوز فعال نشده است");

  // aud — دقیقاً برابرِ هاستِ همین API
  const auds = expectedAudiences(req);
  if (auds.length) {
    const tokenAud = String(payload.aud || "").toLowerCase();
    if (!tokenAud || !auds.includes(tokenAud))
      throw new Error("مخاطبِ (aud) توکن با این سرور مطابقت ندارد");
  }

  return payload;
}

// میدل‌ویرِ اکسپرس — روی روت‌های /torob_api گذاشته می‌شود
function torobAuth(req, res, next) {
  try {
    const token =
      req.get("X-Torob-Token") ||
      req.get("x-torob-token") ||
      "";
    verifyTorobToken(token, req);
    return next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: err.message || "احراز هویتِ ترب ناموفق بود" });
  }
}

module.exports = { verifyTorobToken, torobAuth, TOROB_PUBLIC_KEY };
