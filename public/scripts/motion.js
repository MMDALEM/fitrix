// ==========================================================================
// fitrix • Motion Engine  (scroll-reveal اپل‌گونه + استگر)
// --------------------------------------------------------------------------
// جایگزینِ fx.js و یک نسخه‌ی کامل‌ترِ آن:
//   • هم المان‌های دارای [data-reveal] و هم selectorهای قدیمی را پوشش می‌دهد.
//   • استگر (تأخیرِ پلکانی) برای فرزندانِ [data-reveal-group].
//   • فقط المان‌های «زیرِ خطِ دید» مخفی و انیمیت می‌شوند → بدونِ هیچ فلش/پرشِ
//     اولیه؛ محتوای بالای صفحه بلافاصله دیده می‌شود.
//   • بدونِ JS یا با reduced-motion، هیچ‌چیز پنهان نمی‌ماند (fail-safe).
//   • داخلِ .swiper و المان‌های .reveal (که program.js مدیریت می‌کند) دست نمی‌خورد.
//
// واریانت‌ها:  data-reveal="up|up-sm|scale|fade|right|left"  (پیش‌فرض: up)
// تأخیرِ دستی: data-reveal-delay="0.15"   (ثانیه)
// گروهِ استگر: یک والد با [data-reveal-group] بگذار؛ فرزندانِ [data-reveal]
//              به‌ترتیب تأخیرِ پلکانی می‌گیرند.
// ==========================================================================
(function () {
  var root = document.documentElement;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // میکرو-اینتراکشن‌ها (press/lift) کاملاً CSS هستند و همیشه کار می‌کنند.
  // فقط لایه‌ی reveal به JS/observer نیاز دارد:
  if (reduce || !("IntersectionObserver" in window)) return;

  // این کلاس به CSS اجازه می‌دهد حالتِ اولیه‌ی مخفی را فعال کند.
  root.classList.add("mo-js");

  var AUTO_SELECTOR =
    ".product-card, .tile, .an-type, .prg-benefit, .prg-day, .prg-stat";
  var FOLD = 0.9; // چیزی که top آن پایین‌تر از ۹۰٪ ارتفاعِ view باشد = زیرِ خطِ دید

  function variantClass(el) {
    switch (el.getAttribute("data-reveal")) {
      case "scale": return "mo-scale";
      case "fade":  return "mo-fade";
      case "right": return "mo-right";
      case "left":  return "mo-left";
      case "up-sm": return "mo-up-sm";
      default:      return "mo-up";
    }
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("mo-in");
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
  );

  function init() {
    var vh = window.innerHeight || document.documentElement.clientHeight;

    // ۱) تأخیرِ پلکانی (استگر) را برای گروه‌ها از پیش محاسبه کن
    document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
      var kids = group.querySelectorAll("[data-reveal]");
      Array.prototype.forEach.call(kids, function (el, i) {
        el.__fxStagger = (i % 8) * 0.06;
      });
    });

    // ۲) فهرستِ کاندیداها: explicit + قدیمی
    var candidates = [];
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      candidates.push(el);
    });
    document.querySelectorAll(AUTO_SELECTOR).forEach(function (el) {
      if (!el.hasAttribute("data-reveal")) candidates.push(el);
    });

    candidates.forEach(function (el) {
      // سوییپر و المان‌هایی که قبلاً مدیریت می‌شوند را رها کن
      if (el.closest(".swiper")) return;
      if (el.classList.contains("reveal")) return;
      if (el.classList.contains("mo-init")) return;

      // فقط زیرِ خطِ دید را مخفی کن تا بالای صفحه فلش نخورد
      var rect = el.getBoundingClientRect();
      if (rect.top <= vh * FOLD) return;

      el.classList.add("mo-init", variantClass(el));

      var manual = el.getAttribute("data-reveal-delay");
      var delay = manual != null ? parseFloat(manual) : el.__fxStagger || 0;
      if (delay) el.style.transitionDelay = delay.toFixed(2) + "s";

      io.observe(el);
    });

    // شبکه‌ی ایمنی: اگر به هر دلیلی observer برای المانی فایر نشد،
    // بعد از چند ثانیه همه را نمایان کن (محتوا هرگز مخفی نماند).
    setTimeout(function () {
      document
        .querySelectorAll(".mo-init:not(.mo-in)")
        .forEach(function (el) {
          io.unobserve(el);
          el.classList.add("mo-in");
        });
    }, 4000);
  }

  // ابزارِ عمومی برای پرشِ توجه‌جلب‌کن (مثلاً عددِ سبد بعد از افزودن)
  window.fxBump = function (el) {
    if (!el || reduce) return;
    el.classList.remove("fx-bump");
    // reflow تا انیمیشن دوباره از صفر اجرا شود
    void el.offsetWidth;
    el.classList.add("fx-bump");
    el.addEventListener(
      "animationend",
      function () {
        el.classList.remove("fx-bump");
      },
      { once: true }
    );
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
