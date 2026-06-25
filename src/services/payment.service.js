// ───────────────────────────────────────────────────────────────
// سرویس درگاه‌های پرداخت (زرین‌پال + دیجی‌پی)
//
// هر دو درگاه با متغیرهای محیطی (.env) کنترل می‌شوند. اگر کلید/مرچنت
// تنظیم نشده باشد، به حالت mock (تأیید آزمایشی) برمی‌گردد تا اپ در
// محیط توسعه بدون درگاه واقعی هم کار کند. برای production فقط کافی است
// متغیرهای محیطی را پر کنی.
// ───────────────────────────────────────────────────────────────
const { ZarinPal } = require("zarinpal-node-sdk");

const ZARINPAL_MERCHANT = process.env.ZARINPAL_MERCHANT_ID || "";
const ZARINPAL_SANDBOX = process.env.ZARINPAL_SANDBOX;
const DIGIPAY_USERNAME = process.env.DIGIPAY_USERNAME || "";
const DIGIPAY_PASSWORD = process.env.DIGIPAY_PASSWORD || "";
const DIGIPAY_CLIENT_ID = process.env.DIGIPAY_CLIENT_ID || "";
const DIGIPAY_CLIENT_SECRET = process.env.DIGIPAY_CLIENT_SECRET || "";
const DIGIPAY_SANDBOX = process.env.DIGIPAY_SANDBOX;

const zarinpalConfigured =
  ZARINPAL_MERCHANT &&
  /^[0-9a-fA-F-]{36}$/.test(ZARINPAL_MERCHANT) &&
  ZARINPAL_MERCHANT !== "00000000-0000-0000-0000-000000000000";
const digipayConfigured =
  DIGIPAY_USERNAME && DIGIPAY_PASSWORD && DIGIPAY_CLIENT_ID;

const zarinpal = zarinpalConfigured
  ? new ZarinPal({ merchantId: ZARINPAL_MERCHANT, sandbox: ZARINPAL_SANDBOX })
  : null;

const ZARINPAL_STARTPAY = ZARINPAL_SANDBOX
  ? process.env.ZARINPAL_BASE_URL_TEST
  : process.env.ZARINPAL_BASE_URL;

const DIGIPAY_BASE = DIGIPAY_SANDBOX
  ? process.env.DIGIPAY_BASE_URL
  : process.env.DIGIPAY_BASE_URL_TEST;

const DIGIPAY_VERSION = "2022-02-02";
const DIGIPAY_TYPE = process.env.DIGIPAY_TICKET_TYPE || "0";

class PaymentService {
  isConfigured(gateway) {
    return gateway === "digipay" ? !!digipayConfigured : !!zarinpalConfigured;
  }

  // ───────── زرین‌پال ─────────
  async zarinpalRequest({ amount, callbackUrl, description, mobile, email }) {
    const response = await zarinpal.payments.create({
      amount,
      currency: "IRT",
      callback_url: callbackUrl,
      description,
      mobile,
      email,
    });

    const code = response?.data?.code;
    const authority = response?.data?.authority;
    if ((code === 100 || code === 101) && authority) {
      return { url: `${ZARINPAL_STARTPAY}${authority}`, authority };
    }
    throw new Error("ایجاد تراکنش زرین‌پال ناموفق بود");
  }

  async zarinpalVerify({ amount, authority }) {
    const response = await zarinpal.verifications.verify({ amount, authority });
    const code = response?.data?.code;
    // 100 = موفق، 101 = قبلاً تأیید شده
    if (code === 100 || code === 101) {
      return { ok: true, refId: response?.data?.ref_id || authority };
    }
    return { ok: false, refId: null };
  }

  // ───────── دیجی‌پی ─────────
  async digipayToken() {
    const form = new FormData();
    form.append("username", DIGIPAY_USERNAME);
    form.append("password", DIGIPAY_PASSWORD);
    form.append("grant_type", "password");

    const auth = Buffer.from(
      `${DIGIPAY_CLIENT_ID}:${DIGIPAY_CLIENT_SECRET}`,
    ).toString("base64");

    const res = await fetch(`${DIGIPAY_BASE}/digipay/api/oauth/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!data || !data.access_token) {
      const msg =
        (data && data.result && data.result.message) ||
        (data && data.error_description) ||
        "دریافت توکن دیجی‌پی ناموفق بود (نام کاربری/رمز یا محیط sandbox/production را بررسی کن)";
      throw new Error(msg);
    }
    return data.access_token;
  }

  async digipayRequest({ amount, callbackUrl, cellNumber, providerId }) {
    const token = await this.digipayToken();
    const amountRial = Math.round((Number(amount) || 0) * 10);
    const res = await fetch(
      `${DIGIPAY_BASE}/digipay/api/tickets/business?type=${DIGIPAY_TYPE}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Digipay-Version": DIGIPAY_VERSION,
          Agent: "WEB",
        },
        body: JSON.stringify({
          amount: amountRial,
          cellNumber,
          callbackUrl,
          providerId,
        }),
      },
    );

    const data = await res.json().catch(() => null);
    if (!data || !data.redirectUrl || !data.ticket) {
      const msg =
        (data && data.result && data.result.message) ||
        "ایجاد تیکت دیجی‌پی ناموفق بود";
      throw new Error(msg);
    }
    return { url: data.redirectUrl, ticket: data.ticket };
  }

  async digipayVerify({ trackingCode }) {
    const token = await this.digipayToken();
    const res = await fetch(
      `${DIGIPAY_BASE}/digipay/api/purchases/verify/${trackingCode}?type=${DIGIPAY_TYPE}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Digipay-Version": DIGIPAY_VERSION,
          Agent: "WEB",
        },
      },
    );
    const data = await res.json().catch(() => null);
    const ok = !!data && data.result && data.result.status === 0;
    return { ok, refId: ok ? trackingCode : null };
  }
}

module.exports = new PaymentService();
