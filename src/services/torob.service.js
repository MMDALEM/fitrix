const WEBHOOK_URL = "https://api.torob.com/update/webhook/v1/";
const TIMEOUT_MS = 8000;

function isConfigured() {
  return !!String(process.env.TOROB_WEBHOOK_TOKEN || "").trim();
}

async function notifyTorob(items) {
  try {
    if (!isConfigured()) return false;
    const list = (Array.isArray(items) ? items : [items])
      .filter((x) => x && x.page_url && x.page_unique)
      .map((x) => ({
        page_url: String(x.page_url),
        page_unique: String(x.page_unique),
      }));
    if (!list.length) return false;

    const token = String(process.env.TOROB_WEBHOOK_TOKEN).trim();
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      await sendChunk(chunk, token);
    }
    return true;
  } catch (e) {
    try {
      require("../utils/logError").logError(e, { source: "torob-webhook" });
    } catch {}
    return false;
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
