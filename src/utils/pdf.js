// ───────────────────────────────────────────────────────────────
// تولیدِ فایلِ PDF از HTML با هدلس‌کروم (puppeteer).
//
// خروجی یک Buffer ِ PDF است که مستقیم برای دانلود فرستاده می‌شود.
// فونتِ وزیر (همه‌ی وزن‌ها) به‌صورتِ base64 در HTML جاسازی می‌شود تا در
// خروجیِ PDF بدونِ نیاز به شبکه و کاملاً درست رندر شود.
//
// اجرایِ Chromium:
//   • در حالتِ عادی، puppeteer ِ کامل کرومِ باندل‌شده‌ی خودش را دارد و
//     نیازی به تنظیم نیست.
//   • اگر روی سرور از puppeteer-core استفاده شود یا کروم جای دیگری باشد،
//     مسیر از PUPPETEER_EXECUTABLE_PATH یا مسیرهای رایجِ سیستم پیدا می‌شود.
// ───────────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");

function getPuppeteer() {
  try { return require("puppeteer"); } catch (e) {}
  try { return require("puppeteer-core"); } catch (e) {}
  return null;
}

// مسیرِ اجراییِ کروم را برمی‌گرداند، یا undefined تا puppeteer از کرومِ
// باندل‌شده‌ی خودش استفاده کند.
function resolveChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH)
    return process.env.PUPPETEER_EXECUTABLE_PATH;

  // کرومیومِ Playwright (در محیط‌های مدیریت‌شده) — اگر موجود بود
  try {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
    if (fs.existsSync(base)) {
      const dir = fs
        .readdirSync(base)
        .filter((d) => /^chromium-\d+/.test(d))
        .sort()
        .pop();
      if (dir) {
        const p = path.join(base, dir, "chrome-linux", "chrome");
        if (fs.existsSync(p)) return p;
      }
    }
  } catch (e) {}

  // مسیرهای رایجِ سیستم
  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (e) {}
  }
  return undefined; // puppeteer ِ کامل کرومِ خودش را دارد
}

// همه‌ی ارجاع‌های url("/fonts/Vazir/*.woff2") در HTML را با data URIِ base64
// جایگزین می‌کند تا فونت در PDF بدونِ شبکه و درست بارگذاری شود.
function inlineFonts(html) {
  return html.replace(
    /url\(\s*["']?(\/fonts\/Vazir\/[^"')]+\.woff2)["']?\s*\)/g,
    (match, rel) => {
      try {
        const file = path.join(process.cwd(), "public", rel.replace(/^\//, ""));
        if (fs.existsSync(file)) {
          const b64 = fs.readFileSync(file).toString("base64");
          return "url(data:font/woff2;base64," + b64 + ")";
        }
      } catch (e) {}
      return match; // اگر نشد، همان ارجاعِ اصلی بماند
    },
  );
}

async function htmlToPdf(rawHtml) {
  const pptr = getPuppeteer();
  if (!pptr) throw new Error("puppeteer در دسترس نیست");

  const html = inlineFonts(rawHtml);
  const opts = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  };
  const exe = resolveChromePath();
  if (exe) opts.executablePath = exe;

  const browser = await pptr.launch(opts);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    // اطمینان از آماده‌شدنِ کاملِ فونت‌ها پیش از گرفتنِ PDF
    try { await page.evaluateHandle("document.fonts.ready"); } catch (e) {}
    const out = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    // puppeteer یک Uint8Array برمی‌گرداند؛ برای res.send/نوشتن روی دیسک باید Buffer باشد
    return Buffer.isBuffer(out) ? out : Buffer.from(out);
  } finally {
    try { await browser.close(); } catch (e) {}
  }
}

module.exports = { htmlToPdf };
