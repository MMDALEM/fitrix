// تولیدِ فایلِ PDF از HTML با هدلس‌کروم (برای دانلودِ مستقیم).
// اگر puppeteer در دسترس نبود یا کروم اجرا نشد، تابع throw می‌کند و مسیرِ
// فراخوان به حالتِ نمایشِ HTML (چاپِ مرورگر) برمی‌گردد — یعنی هرگز نمی‌شکند.
const fs = require("fs");
const path = require("path");

function getPuppeteer() {
  try { return require("puppeteer"); } catch (e) {}
  try { return require("puppeteer-core"); } catch (e) {}
  return null;
}

// مسیرِ اجراییِ کروم: از .env یا مسیرهای رایجِ سیستم
function resolveChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch (e) {} }
  return undefined; // puppeteer کامل کرومِ خودش را دارد
}

// فونتِ وزیر را به‌صورتِ base64 در HTML جاسازی می‌کند تا در PDF درست رندر شود
function inlineVazir(html) {
  try {
    const p = path.join(process.cwd(), "public", "fonts", "Vazir", "Vazir.woff2");
    if (fs.existsSync(p)) {
      const b64 = fs.readFileSync(p).toString("base64");
      return html.replace(
        /url\(["']?\/fonts\/Vazir\/Vazir\.woff2["']?\)/g,
        "url(data:font/woff2;base64," + b64 + ")",
      );
    }
  } catch (e) {}
  return html;
}

async function htmlToPdf(rawHtml) {
  const pptr = getPuppeteer();
  if (!pptr) throw new Error("puppeteer در دسترس نیست");
  const html = inlineVazir(rawHtml);
  const opts = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  };
  const exe = resolveChromePath();
  if (exe) opts.executablePath = exe;

  const browser = await pptr.launch(opts);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });
    const out = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
    });
    // puppeteer یک Uint8Array برمی‌گرداند؛ برای res.send باید Buffer باشد
    return Buffer.isBuffer(out) ? out : Buffer.from(out);
  } finally {
    try { await browser.close(); } catch (e) {}
  }
}

module.exports = { htmlToPdf };
