// ── اسکریپت‌های صفحه‌ی برنامه‌ساز (هرکدام فقط اگر عنصرِ مربوطه در صفحه باشد اجرا می‌شود) ──

/* ---------- ۰) Scroll reveal (ظاهرشدنِ نرمِ المان‌ها با اسکرول، مثل صفحاتِ اپل) ---------- */
(function () {
  var els = document.querySelectorAll(".reveal");
  if (!els.length) return;
  if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  els.forEach(function (el) { io.observe(el); });
})();

/* ---------- ۱) کاوشگرِ عضلات ---------- */
(function () {
  var svg = document.getElementById("mmSvg");
  var info = document.getElementById("mmInfo");
  if (!svg || !info) return;

  var DATA = {
    traps: { name: "کول (Trapezius)", text: "عضله‌ی بزرگِ پشتِ گردن و بالای شانه که در جمع‌کردنِ شانه‌ها و ثباتِ گردن نقش دارد.", ex: ["شراگ دمبل", "بارفیکس", "کول با هالتر"] },
    shoulders: { name: "سرشانه (Deltoid)", text: "عضله‌ی سه‌سرِ شانه که پهنای بالاتنه را می‌سازد و در همه‌ی حرکاتِ فشاری بالای سر درگیر است.", ex: ["پرس سرشانه", "نشر جانب", "نشر خم"] },
    chest: { name: "سینه (Pectoralis)", text: "عضله‌ی اصلیِ قفسه‌ی سینه؛ مسئولِ حرکاتِ فشاری و جمع‌کردنِ بازوها به سمتِ مرکز.", ex: ["پرس سینه", "قفسه سینه", "شنا سوئدی"] },
    biceps: { name: "جلوبازو (Biceps)", text: "عضله‌ی جلوی بازو که آرنج را خم می‌کند و در کشیدن‌ها نقش دارد.", ex: ["جلوبازو هالتر", "جلوبازو دمبل", "زیربغل قایقی"] },
    forearms: { name: "ساعد (Forearm)", text: "عضلاتِ ساعد؛ قدرتِ گرفتن (گریپ) و ثباتِ مچ را تأمین می‌کنند.", ex: ["مچ هالتر", "دد لیفت", "فارمر واک"] },
    abs: { name: "شکم (Rectus Abdominis)", text: "عضلاتِ مرکزیِ شکم؛ هسته‌ی بدن را می‌سازند و در ثبات و انتقالِ قدرت حیاتی‌اند.", ex: ["کرانچ", "پلانک", "زیرشکم خلبانی"] },
    obliques: { name: "پهلو (Obliques)", text: "عضلاتِ کناریِ شکم؛ در چرخش و خمِ جانبیِ تنه نقش دارند و کمر را ثبات می‌دهند.", ex: ["کرانچ چرخشی", "پلانک پهلو", "چوب هیزم‌شکن"] },
    quads: { name: "چهارسرِ ران (Quadriceps)", text: "بزرگ‌ترین عضله‌ی جلوی ران؛ در اسکات، دویدن و پرش پایه‌ی قدرتِ پایین‌تنه است.", ex: ["اسکات", "پرس پا", "لانج"] },
    calves: { name: "ساقِ پا (Calves)", text: "عضلاتِ پشتِ ساق؛ در بلندشدن روی پنجه و استقامتِ دویدن نقش دارند.", ex: ["ساق ایستاده", "ساق نشسته", "پرش طناب"] },
  };

  var muscles = svg.querySelectorAll(".mm-m");
  function select(key, el) {
    muscles.forEach(function (m) { m.classList.remove("is-active"); });
    // همه‌ی قطعاتِ همان عضله (چپ/راست) را فعال کن
    svg.querySelectorAll('.mm-m[data-key="' + key + '"]').forEach(function (m) { m.classList.add("is-active"); });
    var d = DATA[key];
    if (!d) return;
    var ex = (d.ex || []).map(function (e) { return "<span>" + e + "</span>"; }).join("");
    info.innerHTML =
      '<span class="mm-info-badge">عضله</span>' +
      '<h4 class="mm-info-title">' + d.name + "</h4>" +
      '<p class="mm-info-text">' + d.text + "</p>" +
      (ex ? '<div class="mm-info-ex">' + ex + "</div>" : "");
    info.classList.remove("pop"); void info.offsetWidth; info.classList.add("pop");
  }
  muscles.forEach(function (m) {
    m.addEventListener("click", function () { select(m.getAttribute("data-key"), m); });
  });

  var toggle = document.getElementById("mmToggle");
  if (toggle) {
    toggle.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        toggle.querySelectorAll("button").forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        svg.setAttribute("data-sex", b.getAttribute("data-sex"));
      });
    });
  }
})();

/* ---------- ۱.۴) فرمِ مرحله‌ای (Wizard) ---------- */
(function () {
  var wz = document.querySelector(".wz");
  if (!wz) return;
  var steps = Array.prototype.slice.call(wz.querySelectorAll(".wz-step"));
  var total = steps.length;
  var fill = document.getElementById("wzFill");
  var curEl = document.getElementById("wzCur");
  var totalEl = document.getElementById("wzTotal");
  var prevBtn = wz.querySelector(".wz-prev");
  var nextBtn = wz.querySelector(".wz-next");
  var submitBtn = wz.querySelector(".wz-submit");
  var i = 0;
  var fa = function (n) { return Number(n).toLocaleString("fa-IR"); };
  if (totalEl) totalEl.textContent = fa(total);

  function render() {
    steps.forEach(function (s, idx) { s.classList.toggle("is-active", idx === i); });
    if (fill) fill.style.width = ((i + 1) / total) * 100 + "%";
    if (curEl) curEl.textContent = fa(i + 1);
    prevBtn.style.visibility = i === 0 ? "hidden" : "visible";
    var last = i === total - 1;
    nextBtn.style.display = last ? "none" : "";
    submitBtn.style.display = last ? "" : "none";
    var firstInput = steps[i].querySelector("input:not([type=radio]), select, input[type=radio]");
    if (firstInput && firstInput.type === "number") { try { firstInput.focus(); } catch (e) {} }
  }

  function valid(step) {
    // گروه‌های رادیوییِ الزامی
    var radios = step.querySelectorAll("input[type=radio]");
    var groups = {};
    radios.forEach(function (r) { groups[r.name] = groups[r.name] || { req: false, checked: false };
      if (r.required) groups[r.name].req = true; if (r.checked) groups[r.name].checked = true; });
    for (var name in groups) { if (groups[name].req && !groups[name].checked) return false; }
    // ورودی‌های الزامیِ غیررادیویی
    var reqs = step.querySelectorAll("input[required]:not([type=radio]), select[required]");
    for (var k = 0; k < reqs.length; k++) {
      if (!reqs[k].value || (reqs[k].checkValidity && !reqs[k].checkValidity())) return false;
    }
    return true;
  }

  function fail() {
    steps[i].classList.remove("wz-shake"); void steps[i].offsetWidth; steps[i].classList.add("wz-shake");
  }

  nextBtn.addEventListener("click", function () {
    if (!valid(steps[i])) { fail(); return; }
    if (i < total - 1) { i++; render(); }
  });
  prevBtn.addEventListener("click", function () { if (i > 0) { i--; render(); } });

  // Enter در مراحلِ میانی = بعدی (نه ارسالِ زودهنگام)
  wz.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && i < total - 1) { e.preventDefault(); nextBtn.click(); }
  });

  render();
})();

/* ---------- ۱.۵) overlای «در حال ساخت» هنگام ارسالِ فرم ---------- */
(function () {
  var form = document.getElementById("programForm");
  var overlay = document.getElementById("prgLoading");
  if (!form || !overlay) return;
  form.addEventListener("submit", function () {
    // اجازه بده مرورگر فرم را ارسال کند، فقط overlای را نشان بده
    setTimeout(function () { overlay.classList.add("show"); }, 10);
  });
})();

/* ---------- ۲) پرسش‌وپاسخِ برنامه ---------- */
(function () {
  var form = document.getElementById("qaForm");
  if (!form) return;
  var list = document.getElementById("qaList");
  var input = document.getElementById("qaInput");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var q = (input.value || "").trim();
    if (!q) return;
    var btn = form.querySelector("button");
    btn.disabled = true;
    var oldLabel = btn.textContent;
    btn.textContent = "…";

    var wrap = document.createElement("div");
    wrap.className = "prg-qa-item";
    var qEl = document.createElement("p");
    qEl.className = "prg-qa-q";
    qEl.textContent = q;
    var aEl = document.createElement("div");
    aEl.className = "prg-qa-a";
    aEl.textContent = "در حال نوشتن…";
    wrap.appendChild(qEl);
    wrap.appendChild(aEl);
    list.appendChild(wrap);
    input.value = "";
    aEl.scrollIntoView({ behavior: "smooth", block: "nearest" });

    try {
      var r = await fetch("/program/" + form.dataset.id + "/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      var data = await r.json();
      aEl.textContent = data && data.success ? data.answer : (data && data.message) || "خطا در پاسخ‌گویی";
    } catch (err) {
      aEl.textContent = "خطا در ارتباط؛ دوباره تلاش کن";
    }
    btn.disabled = false;
    btn.textContent = oldLabel;
  });
})();
