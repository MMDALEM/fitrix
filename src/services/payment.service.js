// ───────────────────────────────────────────────────────────────
// سرویس درگاه‌های پرداخت (زرین‌پال + دیجی‌پی)
//
// هر دو درگاه با متغیرهای محیطی (.env) کنترل می‌شوند. اگر کلید/مرچنت
// تنظیم نشده باشد، به حالت mock (تأیید آزمایشی) برمی‌گردد تا اپ در
// محیط توسعه بدون درگاه واقعی هم کار کند. برای production فقط کافی است
// متغیرهای محیطی را پر کنی.
// ───────────────────────────────────────────────────────────────
const { ZarinPal } = require("zarinpal-node-sdk");

const ZP_MERCHANT = process.env.ZARINPAL_MERCHANT_ID || "";
const ZP_SANDBOX = process.env.ZARINPAL_SANDBOX !== "false"; // پیش‌فرض sandbox
const DIGIPAY_USERNAME = process.env.DIGIPAY_USERNAME || "";
const DIGIPAY_PASSWORD = process.env.DIGIPAY_PASSWORD || "";
const DIGIPAY_CLIENT_ID = process.env.DIGIPAY_CLIENT_ID || "";
const DIGIPAY_CLIENT_SECRET = process.env.DIGIPAY_CLIENT_SECRET || "";

// مرچنت زرین‌پال یک UUID است؛ مقدار placeholder را معتبر نمی‌شماریم.
const zarinpalConfigured =
  ZP_MERCHANT && /^[0-9a-fA-F-]{36}$/.test(ZP_MERCHANT);
const digipayConfigured =
  DIGIPAY_USERNAME && DIGIPAY_PASSWORD && DIGIPAY_CLIENT_ID;

const zarinpal = zarinpalConfigured
  ? new ZarinPal({ merchantId: ZP_MERCHANT, sandbox: ZP_SANDBOX })
  : null;

const ZP_STARTPAY = ZP_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/StartPay/"
  : "https://payment.zarinpal.com/pg/StartPay/";

const DIGIPAY_BASE = "https://api.mydigipay.com";

class PaymentService {
  isConfigured(gateway) {
    return gateway === "digipay" ? !!digipayConfigured : !!zarinpalConfigured;
  }

  // ───────── زرین‌پال ─────────
  // مبلغ به تومان (currency: IRT). خروجی: { url, authority }
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
      return { url: `${ZP_STARTPAY}${authority}`, authority };
    }
    throw new Error("ایجاد تراکنش زرین‌پال ناموفق بود");
  }

  // تأیید پرداخت زرین‌پال. خروجی: { ok, refId }
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
    const body = new URLSearchParams({
      username: DIGIPAY_USERNAME,
      password: DIGIPAY_PASSWORD,
      grant_type: "password",
    });
    const auth = Buffer.from(
      `${DIGIPAY_CLIENT_ID}:${DIGIPAY_CLIENT_SECRET}`,
    ).toString("base64");

    const res = await fetch(`${DIGIPAY_BASE}/digipay/api/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = await res.json();
    if (!data?.access_token) throw new Error("دریافت توکن دیجی‌پی ناموفق بود");
    return data.access_token;
  }

  // type=11 یعنی پرداخت اعتباری/قسطی. خروجی: { url, ticket }
  async digipayRequest({ amount, callbackUrl, cellNumber, providerId }) {
    const token = await this.digipayToken();
    const res = await fetch(
      `${DIGIPAY_BASE}/digipay/api/businesses/ticket?type=11`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          cellNumber,
          callbackUrl,
          providerId,
        }),
      },
    );
    const data = await res.json();
    if (!data?.redirectUrl || !data?.ticket) {
      throw new Error("ایجاد تیکت دیجی‌پی ناموفق بود");
    }
    return { url: data.redirectUrl, ticket: data.ticket };
  }

  // تأیید پرداخت دیجی‌پی. خروجی: { ok, refId }
  async digipayVerify({ trackingCode }) {
    const token = await this.digipayToken();
    const res = await fetch(
      `${DIGIPAY_BASE}/digipay/api/purchases/verify/${trackingCode}?type=11`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await res.json();
    const ok = data?.result?.status === 0; // 0 = موفق در دیجی‌پی
    return { ok, refId: ok ? trackingCode : null };
  }
}

module.exports = new PaymentService();
