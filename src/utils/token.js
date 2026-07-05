const JWT = require("jsonwebtoken");
const crypto = require("crypto");

// require تنبل برای جلوگیری از وابستگی حلقوی و لود نشدن بی‌مورد mongoose
const getUserModel = () => require("../models/user.model");

// اکسس‌توکن کوتاه‌عمر + رفرش‌توکن بلندعمر با چرخش (rotation)
const ACCESS_TTL = "1h";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ۳۰ روز

const accessSecret = () => process.env.JWT_ACCESS_TOKEN_SECRET_USER;
// اگر سکرت جدا برای رفرش تعریف نشده بود، از سکرت اصلی مشتق می‌شود
const refreshSecret = () =>
  process.env.JWT_REFRESH_TOKEN_SECRET_USER ||
  process.env.JWT_ACCESS_TOKEN_SECRET_USER + ".refresh";

const sha256 = (t) => crypto.createHash("sha256").update(t).digest("hex");

const isProd = () => process.env.NODE_ENV === "production";

const cookieOptions = (maxAge) => {
  const opts = {
    httpOnly: true, // همیشه؛ توکن نباید از JS خوانده شود
    secure: isProd(),
    sameSite: "lax", // strict کوکی را در بازگشت از درگاه پرداخت نمی‌فرستد
    path: "/",
  };
  if (isProd() && process.env.COOKIE_DOMAIN)
    opts.domain = process.env.COOKIE_DOMAIN;
  if (maxAge) opts.maxAge = maxAge;
  return opts;
};

exports.cookieOptions = cookieOptions;

// صدور جفت توکن + ذخیره‌ی هش رفرش‌توکن برای امکان ابطال
exports.issueTokens = async function issueTokens(user) {
  const access = JWT.sign(
    { id: user._id, phone: user.phone },
    accessSecret(),
    { expiresIn: ACCESS_TTL },
  );
  const refresh = JWT.sign({ id: user._id, typ: "refresh" }, refreshSecret(), {
    expiresIn: Math.floor(REFRESH_TTL_MS / 1000),
  });
  await getUserModel().updateOne(
    { _id: user._id },
    { $set: { refreshTokenHash: sha256(refresh) } },
  );
  return { access, refresh };
};

exports.setAuthCookies = function setAuthCookies(res, tokens) {
  res.cookie("fitrix_token", tokens.access, cookieOptions(60 * 60 * 1000));
  res.cookie("fitrix_refresh", tokens.refresh, cookieOptions(REFRESH_TTL_MS));
};

exports.clearAuthCookies = function clearAuthCookies(res) {
  res.clearCookie("fitrix_token", cookieOptions());
  res.clearCookie("fitrix_refresh", cookieOptions());
};

// تلاش برای تمدید نشست با رفرش‌توکن؛ در موفقیت توکن‌ها چرخانده می‌شوند
// خروجی: سند کاربر یا null
exports.refreshSession = async function refreshSession(req, res) {
  try {
    const refresh = req.cookies && req.cookies.fitrix_refresh;
    if (!refresh) return null;

    const payload = JWT.verify(refresh, refreshSecret());
    if (payload.typ !== "refresh") return null;

    const user = await getUserModel().findById(payload.id);
    if (!user || !user.isActive) return null;

    // توکن باید با آخرین توکن صادرشده مطابقت داشته باشد (ابطال‌پذیری)
    if (!user.refreshTokenHash || user.refreshTokenHash !== sha256(refresh)) {
      exports.clearAuthCookies(res);
      return null;
    }

    const tokens = await exports.issueTokens(user);
    exports.setAuthCookies(res, tokens);
    return user;
  } catch {
    exports.clearAuthCookies(res);
    return null;
  }
};

// ابطال رفرش‌توکن هنگام خروج
exports.revokeRefreshToken = async function revokeRefreshToken(userId) {
  if (!userId) return;
  await getUserModel()
    .updateOne({ _id: userId }, { $set: { refreshTokenHash: null } })
    .catch(() => {});
};

// ---------- بازگشت به صفحه‌ی قبل از ورود ----------

const RETURN_COOKIE = "fitrix_return_to";

// فقط مسیرهای داخلی امن؛ جلوگیری از open redirect
const isSafePath = (p) =>
  typeof p === "string" &&
  p.length > 1 &&
  p.length < 500 &&
  p.startsWith("/") &&
  !p.startsWith("//") &&
  !p.startsWith("/\\") &&
  !p.startsWith("/auth") &&
  !p.startsWith("/logout");

exports.saveReturnTo = function saveReturnTo(req, res) {
  if (req.method !== "GET") return;
  const target = req.originalUrl;
  if (!isSafePath(target)) return;
  res.cookie(RETURN_COOKIE, target, {
    ...cookieOptions(15 * 60 * 1000),
  });
};

exports.popReturnTo = function popReturnTo(req, res) {
  const target = req.cookies && req.cookies[RETURN_COOKIE];
  res.clearCookie(RETURN_COOKIE, cookieOptions());
  return isSafePath(target) ? target : null;
};
