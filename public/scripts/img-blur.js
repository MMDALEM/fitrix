/*
 * لودینگ تصاویر با حالتِ مات + شیمر
 * ------------------------------------------------------------------
 * هر عکسِ محتوایی تا وقتی کامل لود نشده، با کلاس img-blur-load یک حالت
 * «در حال بارگذاری» (مات و شیمری) می‌گیرد؛ به‌محض رویداد load، کلاس
 * is-loaded اضافه شده و عکس نرم و شفاف جایگزین می‌شود.
 *
 * آیکن‌ها، لوگوها، SVGها و عکس‌های داخل هدر/فوتر/منو مستثنا هستند تا
 * ظاهر رابط کاربری به‌هم نریزد. برای مستثنا کردن دستیِ هر عکس کافی است
 * کلاس no-blur را به آن بدهید.
 */
(function () {
  "use strict";

  function shouldSkip(img) {
    if (img.dataset.blurInit) return true;
    if (img.classList.contains("no-blur")) return true;
    var src = img.getAttribute("src") || "";
    // آیکن‌های SVG و دیتا-یو‌آر‌آی‌های کوچک را رها کن
    if (/\.svg(\?|$)/i.test(src) || /^data:/i.test(src)) return true;
    // عکس‌های ساختاری رابط کاربری (لوگو، آیکن منو و ...)
    if (img.closest("header, footer, nav, .menu, .menu-mobile, .search-overlay"))
      return true;
    return false;
  }

  // کمینه‌ی زمانِ نمایشِ حالتِ لودینگ (میلی‌ثانیه) تا حتی عکس‌های سریع هم
  // یک لحظه حالت «در حال بارگذاری» را نشان بدهند و پرش ناگهانی نداشته باشند
  var MIN_SHOW_MS = 320;

  function markLoaded(img) {
    img.classList.add("is-loaded");
  }

  function enhance(img) {
    if (shouldSkip(img)) return;
    img.dataset.blurInit = "1";
    img.classList.add("img-blur-load");

    // اگر عکس از قبل (کش) لود شده، مستقیم و بدون تأخیر نمایش بده
    if (img.complete && img.naturalWidth > 0) {
      markLoaded(img);
      return;
    }

    var start = Date.now();
    function done() {
      var wait = MIN_SHOW_MS - (Date.now() - start);
      if (wait > 0) setTimeout(function () { markLoaded(img); }, wait);
      else markLoaded(img);
    }
    img.addEventListener("load", done, { once: true });
    // در صورت خطای لود هم شیمر را متوقف کن تا گیر نکند
    img.addEventListener("error", function () { markLoaded(img); }, { once: true });
  }

  function scan(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("img").forEach(enhance);
  }

  function init() {
    scan(document);

    // عکس‌هایی که بعداً به صفحه اضافه می‌شوند (اسلایدر، فیلتر شاپ، لود
    // پویا و ...) را هم پوشش بده
    if (window.MutationObserver) {
      new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var nodes = mutations[i].addedNodes;
          for (var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            if (node.nodeType !== 1) continue;
            if (node.tagName === "IMG") enhance(node);
            else if (node.querySelectorAll) node.querySelectorAll("img").forEach(enhance);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
