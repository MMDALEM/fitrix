// ==========================================================================
// fitrix • Image blur-in loader
// --------------------------------------------------------------------------
// تا وقتی تصویر لود نشده، یک اسکلتِ شیمر (کلاس img-blur-load) نشان داده می‌شود
// و به‌محضِ آماده‌شدن با یک بلورِ نرم جایگزین می‌شود (is-loaded).
// استایل‌ها در home/master تعریف شده‌اند؛ این اسکریپت فقط کلاس‌ها را مدیریت می‌کند.
//
// امن‌سازی:
//   • فقط تصاویرِ رستریِ محتوایی (jpg/png/webp/gif) — آیکون‌های SVG دست نمی‌خورند.
//   • تصاویرِ از قبل کش‌شده افکت نمی‌گیرند (بدونِ فلشِ بی‌مورد).
//   • خطای بارگذاری، کلاس را پاک می‌کند تا هیچ تصویری در حالتِ شیمر گیر نکند.
//   • با prefers-reduced-motion کاملاً غیرفعال می‌شود.
// ==========================================================================
(function () {
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;

  function enhance(img) {
    if (!img || img.dataset.blurDone) return;
    if (img.dataset.noBlur !== undefined) return; // data-no-blur = صرف‌نظر
    if (typeof img.closest === "function" && img.closest("svg")) return;

    var src = img.getAttribute("src") || "";
    if (!/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(src)) return; // فقط رستری

    // اگر بارگذاری از قبل تمام شده (کش‌شده یا خطاخورده) هیچ کاری نکن؛ افکت فقط
    // برای تصاویری معنا دارد که همین حالا در حالِ لود شدن‌اند. این از «گیر کردنِ
    // شیمر» به‌خاطرِ رویدادِ لود/خطایی که پیش از این اجرا شده جلوگیری می‌کند.
    if (img.complete) {
      img.dataset.blurDone = "1";
      return;
    }

    img.classList.add("img-blur-load");

    var safety = null;
    function cleanup() {
      if (safety) clearTimeout(safety);
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      img.dataset.blurDone = "1";
    }
    function onLoad() {
      img.classList.add("is-loaded");
      cleanup();
    }
    function onError() {
      img.classList.remove("img-blur-load"); // در حالتِ شیمر گیر نکند
      cleanup();
    }

    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
    // شبکه‌ی ایمنی: اگر به هر دلیلی رویدادِ load/error نرسید، بعد از ۸ ثانیه
    // شیمر را بردار تا هیچ تصویری برای همیشه در حالتِ لود گیر نکند.
    safety = setTimeout(function () {
      img.classList.remove("img-blur-load");
      cleanup();
    }, 8000);
  }

  function run() {
    var imgs = document.querySelectorAll("img");
    Array.prototype.forEach.call(imgs, enhance);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", run);
  else run();
})();
