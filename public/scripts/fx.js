// انیمیشنِ نرمِ سراسریِ سایت (scroll-reveal اپل‌گونه)
// فقط المان‌هایی که «زیرِ خطِ دید» هستند انیمیت می‌شوند تا هیچ فلش/پرشی رخ ندهد
// و اگر JS اجرا نشود، همه‌چیز عادی و دیده‌شدنی می‌ماند.
(function () {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var selectors = [".product-card", ".tile", ".an-type", ".prg-benefit", ".prg-day", ".prg-stat"];
  var candidates = [];
  selectors.forEach(function (s) {
    document.querySelectorAll(s).forEach(function (el) {
      if (el.closest(".swiper")) return;           // اسلایدرها را دست نزن
      if (el.classList.contains("reveal")) return; // قبلاً reveal دارد
      candidates.push(el);
    });
  });
  if (!candidates.length) return;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.08, rootMargin: "0px 0px -5% 0px" });

  var vh = window.innerHeight || document.documentElement.clientHeight;
  candidates.forEach(function (el, i) {
    // فقط المان‌های پایین‌ترِ خطِ دید (نامرئی برای کاربر) → بدون فلش
    if (el.getBoundingClientRect().top > vh * 0.9) {
      el.classList.add("reveal");
      el.style.transitionDelay = ((i % 6) * 0.04).toFixed(2) + "s";
      io.observe(el);
    }
  });
})();
