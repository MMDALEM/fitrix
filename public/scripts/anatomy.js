// بدن‌شناسی — نقشه‌ی عضلاتِ تعاملی (وانیلا؛ به jQuery وابسته نیست)
(function () {
  var stage = document.getElementById("anMaps");
  var info = document.getElementById("anInfo");
  var body = document.getElementById("anInfoBody");
  if (!stage || !info || !body) return;

  var M = {
    chest: { n: "سینه (Pectoralis)", t: "عضله‌ی اصلیِ قفسه‌ی سینه؛ مسئولِ حرکاتِ فشاری و جمع‌کردنِ بازوها به مرکز.", e: ["پرس سینه", "قفسه سینه", "شنا سوئدی"] },
    shoulders: { n: "سرشانه (Deltoid)", t: "عضله‌ی سه‌سرِ شانه که پهنای بالاتنه را می‌سازد و در حرکاتِ فشاریِ بالای سر درگیر است.", e: ["پرس سرشانه", "نشر جانب", "نشر خم"] },
    biceps: { n: "جلوبازو (Biceps)", t: "عضله‌ی جلوی بازو؛ آرنج را خم می‌کند و در کشیدن‌ها نقش دارد.", e: ["جلوبازو هالتر", "جلوبازو دمبل", "زیربغل قایقی"] },
    triceps: { n: "پشت‌بازو (Triceps)", t: "عضله‌ی سه‌سرِ پشتِ بازو؛ حدودِ دوسومِ حجمِ بازو را می‌سازد و آرنج را باز می‌کند.", e: ["پرس دست جمع", "پشت‌بازو سیم‌کش", "دیپ"] },
    forearms: { n: "ساعد (Forearm)", t: "عضلاتِ ساعد؛ قدرتِ گرفتن (گریپ) و ثباتِ مچ را تأمین می‌کنند.", e: ["مچ هالتر", "ددلیفت", "فارمر واک"] },
    traps: { n: "کول (Trapezius)", t: "عضله‌ی بزرگِ پشتِ گردن و بالای شانه؛ در جمع‌کردنِ شانه‌ها و ثباتِ گردن نقش دارد.", e: ["شراگ دمبل", "بارفیکس", "کول هالتر"] },
    traps_middle: { n: "میانه‌ی پشت (Mid-Traps)", t: "بخشِ میانیِ کول و عضلاتِ بینِ کتف؛ برای فرمِ ایستادنِ صاف و کشیدن‌های افقی حیاتی است.", e: ["فیس پول", "زیربغل قایقی", "شراگ خوابیده"] },
    lats: { n: "زیربغل (Latissimus)", t: "بزرگ‌ترین عضله‌ی پشت؛ فرمِ V بالاتنه را می‌سازد و در کشیدن‌های عمودی درگیر است.", e: ["بارفیکس", "زیربغل سیم‌کش", "اره‌ای دمبل"] },
    lowerback: { n: "فیله‌ی کمر (Lower Back)", t: "عضلاتِ راست‌کننده‌ی ستونِ فقرات؛ کمر را ثبات می‌دهند و در ددلیفت پایه‌اند.", e: ["ددلیفت", "هایپراکستنشن", "گودمورنینگ"] },
    abdominals: { n: "شکم (Rectus Abdominis)", t: "عضلاتِ مرکزیِ شکم؛ هسته‌ی بدن را می‌سازند و در ثبات و انتقالِ قدرت حیاتی‌اند.", e: ["کرانچ", "پلانک", "زیرشکم خلبانی"] },
    obliques: { n: "پهلو (Obliques)", t: "عضلاتِ کناریِ شکم؛ در چرخش و خمِ جانبیِ تنه نقش دارند و کمر را ثبات می‌دهند.", e: ["کرانچ چرخشی", "پلانک پهلو", "چوب هیزم‌شکن"] },
    quads: { n: "چهارسرِ ران (Quadriceps)", t: "بزرگ‌ترین عضله‌ی جلوی ران؛ در اسکات، دویدن و پرش پایه‌ی قدرتِ پایین‌تنه است.", e: ["اسکات", "پرس پا", "لانج"] },
    hamstrings: { n: "همسترینگ (Hamstrings)", t: "عضلاتِ پشتِ ران؛ زانو را خم و لگن را باز می‌کنند؛ برای قدرت و پیشگیری از آسیب مهم‌اند.", e: ["ددلیفت رومانیایی", "پشت پا دستگاه", "پل باسن"] },
    glutes: { n: "باسن (Glutes)", t: "بزرگ‌ترین و قوی‌ترین عضله‌ی بدن؛ در باز کردنِ لگن، اسکات و ددلیفت نقشِ اصلی دارد.", e: ["هیپ تراست", "اسکات", "لانج"] },
    calves: { n: "ساقِ پا (Calves)", t: "عضلاتِ پشتِ ساق؛ در بلندشدن روی پنجه و استقامتِ دویدن نقش دارند.", e: ["ساق ایستاده", "ساق نشسته", "پرش طناب"] },
  };

  function activeMap() {
    var all = stage.querySelectorAll(".an-sex-map");
    for (var i = 0; i < all.length; i++) { if (all[i].style.display !== "none") return all[i]; }
    return stage;
  }
  function clearActive() {
    stage.querySelectorAll(".body-map__muscle.is-active").forEach(function (g) { g.classList.remove("is-active"); });
  }
  function show(key) {
    var d = M[key];
    if (!d) return;
    clearActive();
    activeMap().querySelectorAll('.body-map__muscle[id="' + key + '"]').forEach(function (g) { g.classList.add("is-active"); });
    var ex = (d.e || []).map(function (x) { return "<span>" + x + "</span>"; }).join("");
    body.innerHTML =
      '<span class="an-info-badge">عضله</span>' +
      '<h2 class="an-info-title">' + d.n + "</h2>" +
      '<p class="an-info-text">' + d.t + "</p>" +
      (ex ? '<div class="an-info-ex">' + ex + "</div>" : "");
    info.classList.remove("pop"); void info.offsetWidth; info.classList.add("pop");
    info.classList.add("show"); // موبایل: بات‌شیت بالا می‌آید
  }

  stage.addEventListener("click", function (e) {
    var g = e.target.closest(".body-map__muscle");
    if (!g || !g.id) return;
    show(g.id);
  });

  var closeBtn = document.getElementById("anInfoClose");
  if (closeBtn) closeBtn.addEventListener("click", function () { info.classList.remove("show"); clearActive(); });

  // تعویضِ آقا/خانم — کلِ بلاکِ هر جنسیت (جلو + پشت)
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
