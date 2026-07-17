// ==========================================================================
// fitrix • SweetAlert confirmation
// --------------------------------------------------------------------------
// به‌جای confirm()/alert() پیش‌فرضِ مرورگر، از SweetAlert2 استفاده می‌کند.
// کافی است روی فرم یا لینک/دکمه صفتِ data-confirm بگذاری:
//   <form ... data-confirm="این مورد حذف شود؟"> ... </form>
//   <a href="..." data-confirm="مطمئنی؟"> ... </a>
// صفت‌های اختیاری:
//   data-confirm-btn="بله، حذف کن"   متنِ دکمه‌ی تأیید
//   data-confirm-icon="warning"      آیکون (warning|question|error|info)
//   data-confirm-safe                رنگِ آبیِ غیرخطرناک (پیش‌فرض قرمزِ خطرناک)
//
// اگر Swal لود نشده باشد، fail-open می‌شود (عمل انجام می‌شود) تا چیزی قفل نشود.
// ==========================================================================
(function () {
  function ask(el) {
    if (!window.Swal) return Promise.resolve(true);
    return window.Swal
      .fire({
        title: el.getAttribute("data-confirm") || "آیا مطمئن هستید؟",
        icon: el.getAttribute("data-confirm-icon") || "warning",
        showCancelButton: true,
        confirmButtonText: el.getAttribute("data-confirm-btn") || "بله، انجام بده",
        cancelButtonText: "انصراف",
        confirmButtonColor: el.hasAttribute("data-confirm-safe")
          ? "#2563eb"
          : "#ef4444",
        cancelButtonColor: "#6b7280",
        reverseButtons: true,
        focusCancel: true,
      })
      .then(function (r) {
        return !!r.isConfirmed;
      });
  }

  // فرم‌های دارای data-confirm
  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!form || form.nodeName !== "FORM" || !form.hasAttribute("data-confirm"))
        return;
      if (form.__confirmed) {
        form.__confirmed = false;
        return;
      } // عبورِ دومِ مجاز
      e.preventDefault();
      e.stopPropagation();
      ask(form).then(function (ok) {
        if (!ok) return;
        form.__confirmed = true;
        if (form.requestSubmit) form.requestSubmit();
        else form.submit();
      });
    },
    true,
  );

  // لینک/دکمه‌های دارای data-confirm (خارج از فرمِ data-confirm)
  document.addEventListener(
    "click",
    function (e) {
      var el = e.target.closest
        ? e.target.closest("a[data-confirm],button[data-confirm]")
        : null;
      if (!el) return;
      if (el.closest("form[data-confirm]")) return; // فرم خودش هندل می‌کند
      if (el.__confirmed) {
        el.__confirmed = false;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      ask(el).then(function (ok) {
        if (!ok) return;
        var href = el.getAttribute("href");
        if (el.nodeName === "A" && href && href !== "#") {
          window.location.href = href;
          return;
        }
        el.__confirmed = true;
        el.click();
      });
    },
    true,
  );
})();
