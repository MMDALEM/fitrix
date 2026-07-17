// بدن‌شناسی — نقشه‌ی عضلاتِ تعاملی (وانیلا)
(function () {
  var stage = document.getElementById("anMaps");
  var info = document.getElementById("anInfo");
  var body = document.getElementById("anInfoBody");
  if (!stage || !info || !body) return;

  var M = {
    chest: { n: "سینه (Pectoralis)", t: "عضله‌ی اصلیِ قفسه‌ی سینه؛ مسئولِ حرکاتِ فشاری و جمع‌کردنِ بازوها به مرکز.", e: ["پرس سینه هالتر", "پرس بالاسینه دمبل", "قفسه سینه دمبل", "کراس‌اوور سیم‌کش", "دیپ سینه", "شنا سوئدی"] },
    shoulders: { n: "سرشانه (Deltoid)", t: "عضله‌ی سه‌سرِ شانه که پهنای بالاتنه را می‌سازد و در حرکاتِ فشاریِ بالای سر درگیر است.", e: ["پرس سرشانه هالتر", "پرس آرنولد", "نشر جانب دمبل", "نشر خم", "نشر از جلو", "فیس‌پول"] },
    biceps: { n: "جلوبازو (Biceps)", t: "عضله‌ی جلوی بازو؛ آرنج را خم می‌کند و در کشیدن‌ها نقش دارد.", e: ["جلوبازو هالتر", "جلوبازو دمبل", "جلوبازو چکشی", "جلوبازو لاری", "جلوبازو سیم‌کش", "بارفیکس دست‌جمع"] },
    triceps: { n: "پشت‌بازو (Triceps)", t: "عضله‌ی سه‌سرِ پشتِ بازو؛ حدودِ دوسومِ حجمِ بازو را می‌سازد و آرنج را باز می‌کند.", e: ["پرس دست‌جمع", "پشت‌بازو سیم‌کش", "پشت‌بازو دمبل بالای سر", "دیپ", "کیک‌بک", "پرس فرانسوی"] },
    forearms: { n: "ساعد (Forearm)", t: "عضلاتِ ساعد؛ قدرتِ گرفتن (گریپ) و ثباتِ مچ را تأمین می‌کنند.", e: ["مچ هالتر", "مچ معکوس", "فارمر واک", "ددلیفت", "جلوبازو چکشی", "آویزان از بار"] },
    traps: { n: "کول (Trapezius)", t: "عضله‌ی بزرگِ پشتِ گردن و بالای شانه؛ در جمع‌کردنِ شانه‌ها و ثباتِ گردن نقش دارد.", e: ["شراگ هالتر", "شراگ دمبل", "کول قایقی", "فیس‌پول", "ددلیفت", "کول ایستاده هالتر"] },
    traps_middle: { n: "میانه‌ی پشت (Mid-Traps)", t: "بخشِ میانیِ کول و عضلاتِ بینِ کتف؛ برای فرمِ ایستادنِ صاف و کشیدن‌های افقی حیاتی است.", e: ["فیس‌پول", "زیربغل قایقی", "فلای معکوس دمبل", "شراگ خوابیده", "پارویی خم هالتر", "بارفیکس"] },
    lats: { n: "زیربغل (Latissimus)", t: "بزرگ‌ترین عضله‌ی پشت؛ فرمِ V بالاتنه را می‌سازد و در کشیدن‌های عمودی درگیر است.", e: ["بارفیکس", "زیربغل سیم‌کش (لت)", "اره‌ای دمبل", "پارویی هالتر خم", "زیربغل تک‌دمبل", "پول‌اور"] },
    lowerback: { n: "فیله‌ی کمر (Lower Back)", t: "عضلاتِ راست‌کننده‌ی ستونِ فقرات؛ کمر را ثبات می‌دهند و در ددلیفت پایه‌اند.", e: ["ددلیفت", "هایپراکستنشن", "گودمورنینگ", "ددلیفت رومانیایی", "پل باسن", "سوپرمن"] },
    abdominals: { n: "شکم (Rectus Abdominis)", t: "عضلاتِ مرکزیِ شکم؛ هسته‌ی بدن را می‌سازند و در ثبات و انتقالِ قدرت حیاتی‌اند.", e: ["کرانچ", "پلانک", "زیرشکم خلبانی", "کرانچ سیم‌کش", "چرخِ شکم (Ab Wheel)", "بالا آوردنِ پا آویزان"] },
    obliques: { n: "پهلو (Obliques)", t: "عضلاتِ کناریِ شکم؛ در چرخش و خمِ جانبیِ تنه نقش دارند و کمر را ثبات می‌دهند.", e: ["کرانچ چرخشی", "پلانک پهلو", "چوب هیزم‌شکن سیم‌کش", "راشن توییست", "کرانچ دوچرخه", "خمِ پهلو دمبل"] },
    quads: { n: "چهارسرِ ران (Quadriceps)", t: "بزرگ‌ترین عضله‌ی جلوی ران؛ در اسکات، دویدن و پرش پایه‌ی قدرتِ پایین‌تنه است.", e: ["اسکات", "پرس پا", "لانج", "جلو پا دستگاه", "هاک اسکات", "اسکات بلغاری"] },
    hamstrings: { n: "همسترینگ (Hamstrings)", t: "عضلاتِ پشتِ ران؛ زانو را خم و لگن را باز می‌کنند؛ برای قدرت و پیشگیری از آسیب مهم‌اند.", e: ["ددلیفت رومانیایی", "پشت پا خوابیده", "پشت پا نشسته", "پل باسن", "گودمورنینگ", "ددلیفت تک‌پا"] },
    glutes: { n: "باسن (Glutes)", t: "بزرگ‌ترین و قوی‌ترین عضله‌ی بدن؛ در باز کردنِ لگن، اسکات و ددلیفت نقشِ اصلی دارد.", e: ["هیپ تراست", "اسکات", "لانج", "ددلیفت رومانیایی", "کیک‌بک باسن", "پل باسن تک‌پا"] },
    calves: { n: "ساقِ پا (Calves)", t: "عضلاتِ پشتِ ساق؛ در بلندشدن روی پنجه و استقامتِ دویدن نقش دارند.", e: ["ساق ایستاده", "ساق نشسته", "ساق روی پرس پا", "پرش طناب", "ساق تک‌پا", "دویدن روی پنجه"] },
  };

  function clearActive() {
    stage.querySelectorAll(".body-map__muscle.is-active").forEach(function (g) { g.classList.remove("is-active"); });
  }

  function positionPopover(rect) {
    if (window.innerWidth >= 860) { info.style.top = ""; info.style.left = ""; return; }
    var w = Math.min(320, window.innerWidth * 0.88);
    var left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    // پیش‌فرض زیرِ عضله؛ اگر جا نبود بالای آن
    var top = rect.bottom + 10;
    var estH = Math.min(window.innerHeight * 0.6, 320);
    if (top + estH > window.innerHeight - 8) top = Math.max(8, rect.top - estH - 10);
    if (top < 8) top = 8;
    info.style.left = left + "px";
    info.style.top = top + "px";
  }

  function show(groupEl) {
    var key = groupEl.id;
    var d = M[key];
    if (!d) return;
    clearActive();
    // فقط عضله‌ی هم‌نامِ داخلِ همان بدن (آقا/خانم) که کلیک شده
    var sexMap = groupEl.closest(".an-sex-map") || stage;
    sexMap.querySelectorAll('.body-map__muscle[id="' + key + '"]').forEach(function (g) { g.classList.add("is-active"); });

    var ex = (d.e || []).map(function (x) { return "<span>" + x + "</span>"; }).join("");
    body.innerHTML =
      '<span class="an-info-badge">عضله</span>' +
      '<h2 class="an-info-title">' + d.n + "</h2>" +
      '<p class="an-info-text">' + d.t + "</p>" +
      '<p class="an-info-exhead">بهترین حرکاتِ این ماهیچه</p>' +
      '<div class="an-info-ex">' + ex + "</div>";

    positionPopover(groupEl.getBoundingClientRect());
    info.classList.remove("pop"); void info.offsetWidth; info.classList.add("pop");
    info.classList.add("show");
  }

  stage.addEventListener("click", function (e) {
    var g = e.target.closest(".body-map__muscle");
    if (!g || !g.id) return;
    show(g);
  });

  var closeBtn = document.getElementById("anInfoClose");
  if (closeBtn) closeBtn.addEventListener("click", function () { info.classList.remove("show"); clearActive(); });

  // تعویضِ آقا/خانم — فقط یک بدن در هر لحظه
  var toggle = document.getElementById("anSexToggle");
  var maps = stage.querySelectorAll(".an-sex-map");
  if (toggle && maps.length) {
    toggle.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        toggle.querySelectorAll("button").forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        var sex = b.getAttribute("data-sex");
        maps.forEach(function (m) { m.style.display = m.getAttribute("data-sex") === sex ? "block" : "none"; });
        clearActive();
        info.classList.remove("show");
      });
    });
  }
})();
