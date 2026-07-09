// محدودکننده‌ی نرخِ سبک و در حافظه (بدون وابستگیِ بیرونی).
// برای جلوگیری از brute-force روی ورود ادمین و تأیید کد OTP.
// نکته: چون در حافظه است، در استقرارِ چند-پروسه‌ای هر پروسه سبدِ خودش را
// دارد؛ برای فروشگاه تک‌سروری کافی است. برای مقیاس بالا از Redis استفاده شود.

const buckets = new Map();

/**
 * @param {string} key   کلیدِ یکتا (مثلاً `admin_login:<ip>`)
 * @param {{max?:number, windowMs?:number}} opts
 * @returns {{limited:boolean, remaining:number, retryMs:number}}
 */
function rateLimit(key, { max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    b = { count: 0, start: now };
    buckets.set(key, b);
  }
  b.count += 1;

  // پاک‌سازیِ تنبل تا نقشه بی‌رویه رشد نکند
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (now - v.start > windowMs) buckets.delete(k);
    }
  }

  return {
    limited: b.count > max,
    remaining: Math.max(0, max - b.count),
    retryMs: Math.max(0, windowMs - (now - b.start)),
  };
}

// در موفقیت (ورودِ درست) شمارنده را صفر می‌کنیم تا کاربرِ مجاز محدود نشود
function resetRateLimit(key) {
  buckets.delete(key);
}

module.exports = { rateLimit, resetRateLimit };
