const mongoose = require("mongoose");
const controller = require("../.controller");
const ProgramPlan = require("../../models/programPlan.model");
const userModel = require("../../models/user.model");
const settingModel = require("../../models/setting.model");
const programService = require("../../services/program.service");
const paymentService = require("../../services/payment.service");

const GOALS = ["muscle", "fatloss", "recomp", "strength", "endurance", "fitness"];
const EXP = ["beginner", "intermediate", "advanced"];
const PLACES = ["gym", "home", "none"];
const ACTS = ["sedentary", "light", "moderate", "active", "very"];
const BODY = ["ecto", "meso", "endo"];

function clampNum(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

class programController extends controller {
  // صفحه‌ی فرمِ برنامه‌ساز
  async page(req, res, next) {
    try {
      const s = await settingModel.getSingleton();
      if (!s.programEnabled) {
        return res.render("program/disabled", { pageTitle: "برنامه‌ساز هوشمند", noindex: true });
      }
      return res.render("program/form", {
        pageTitle: "برنامه‌ساز هوشمند ورزشی و تغذیه",
        metaDescription:
          "دریافت برنامه‌ی تمرینی و تغذیه‌ی شخصی‌سازی‌شده با هوش مصنوعی؛ متناسب با هدف، سطح، تیپ بدنی و شرایط شما.",
        price: s.programPrice || 0,
        effective: s.programEffectivePrice(),
        onSale: s.programEffectivePrice() < (s.programPrice || 0),
      });
    } catch (err) {
      next(err);
    }
  }

  // ساخت + تولیدِ فوریِ برنامه (کامل)، سپس نمایشِ پیش‌نمایش
  async create(req, res, next) {
    try {
      if (!programService.isConfigured())
        return this.alertAndReview(req, res, { title: "سرویس هوش مصنوعی هنوز فعال نشده است", icon: "error" }, "/program");

      // محافظت از سوءاستفاده: هر کاربر حداکثر ۴ برنامه‌ی بازنشده در ۲۴ ساعت
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      const recentUnpaid = await ProgramPlan.countDocuments({
        user: req.user._id, unlocked: false, createdAt: { $gte: since },
      });
      if (recentUnpaid >= 4)
        return this.alertAndReview(req, res, { title: "به حدِ ساختِ روزانه رسیدی؛ یکی از برنامه‌هایت را باز کن یا فردا دوباره تلاش کن", icon: "warning" }, "/program/mine");

      const b = req.body || {};
      const gender = b.gender === "female" ? "female" : b.gender === "male" ? "male" : null;
      if (!gender) return this.alertAndBack(req, res, { title: "لطفاً جنسیت را انتخاب کنید", icon: "warning" });
      if (!GOALS.includes(b.goal)) return this.alertAndBack(req, res, { title: "لطفاً هدفت را انتخاب کن", icon: "warning" });

      const fullName = String(b.fullName || "").trim().slice(0, 80);

      const intake = {
        user: req.user._id,
        fullName,
        gender,
        age: clampNum(b.age, 12, 90, 25),
        height: clampNum(b.height, 120, 230, 175),
        weight: clampNum(b.weight, 30, 250, 75),
        goal: b.goal,
        bodyType: BODY.includes(b.bodyType) ? b.bodyType : "",
        experience: EXP.includes(b.experience) ? b.experience : "beginner",
        daysPerWeek: clampNum(b.daysPerWeek, 1, 7, 3),
        place: PLACES.includes(b.place) ? b.place : "gym",
        activity: ACTS.includes(b.activity) ? b.activity : "moderate",
        injuries: String(b.injuries || "").slice(0, 300),
        diet: String(b.diet || "").slice(0, 300),
        budget: clampNum(b.budget, 0, 100000000, 0),
      };
      intake.metrics = programService.computeMetrics(intake);
      intake.status = "generating";

      const plan = await ProgramPlan.create(intake);

      // ذخیره‌ی نام در پروفایلِ کاربر (اگر خالی بود)
      if (fullName) {
        try {
          const parts = fullName.split(/\s+/);
          const set = {};
          if (!req.user.firstName) set.firstName = parts[0];
          if (!req.user.lastName && parts.length > 1) set.lastName = parts.slice(1).join(" ");
          if (Object.keys(set).length) await userModel.updateOne({ _id: req.user._id }, { $set: set });
        } catch (e) {}
      }

      // تولید در پس‌زمینه انجام می‌شود؛ کاربر بلافاصله به صفحه‌ی «در حال ساخت»
      // هدایت می‌شود و آن‌جا با poll منتظرِ آماده‌شدن می‌ماند. این‌طور درخواستِ
      // HTTP فوری برمی‌گردد و هرگز به تایم‌اوتِ nginx (۵۰۴) نمی‌خورد.
      this._generate(plan).catch((e) => plan_fail_note(e));
      return res.redirect(`/program/${plan._id}`);
    } catch (err) {
      next(err);
    }
  }

  async _own(req) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const plan = await ProgramPlan.findById(id);
    if (!plan || plan.user.toString() !== req.user._id.toString()) return null;
    return plan;
  }

  // تولیدِ دوباره در صورتِ شکست
  async regenerate(req, res, next) {
    try {
      const plan = await this._own(req);
      if (!plan) return this.alertAndReview(req, res, { title: "برنامه یافت نشد", icon: "error" }, "/program");
      // تولیدِ دوباره هم در پس‌زمینه؛ کاربر به صفحه‌ی «در حال ساخت» می‌رود
      plan.status = "generating";
      await plan.save();
      this._generate(plan).catch((e) => plan_fail_note(e));
      return res.redirect(`/program/${plan._id}`);
    } catch (err) {
      next(err);
    }
  }

  // حذفِ برنامه (فقط مالک)
  async remove(req, res, next) {
    try {
      const plan = await this._own(req);
      if (!plan) return this.alertAndReview(req, res, { title: "برنامه یافت نشد", icon: "error" }, "/program/mine");
      await ProgramPlan.deleteOne({ _id: plan._id });
      return this.alertAndReview(req, res, { title: "برنامه حذف شد", icon: "success" }, "/program/mine");
    } catch (err) {
      next(err);
    }
  }

  // شروعِ پرداخت برای بازکردنِ کاملِ برنامه
  async pay(req, res, next) {
    try {
      const plan = await this._own(req);
      if (!plan) return this.alertAndReview(req, res, { title: "برنامه یافت نشد", icon: "error" }, "/program");
      if (plan.unlocked) return res.redirect(`/program/${plan._id}`);
      if (plan.status !== "ready") return res.redirect(`/program/${plan._id}`);

      const gateway = ["zarinpal", "digipay"].includes(req.body.gateway) ? req.body.gateway : "zarinpal";
      const s = await settingModel.getSingleton();
      const amount = s.programEffectivePrice();
      plan.price = amount;
      plan.gateway = gateway;

      const base = `${req.protocol}://${req.get("host")}`;
      const callbackUrl = `${base}/program/${plan._id}/verify/${gateway}`;

      try {
        if (!paymentService.isConfigured(gateway)) {
          if (process.env.NODE_ENV === "production")
            return this.alertAndReview(req, res, { title: "درگاه پرداخت در دسترس نیست", icon: "error" }, `/program/${plan._id}`);
          await plan.save();
          return res.redirect(`/program/${plan._id}/verify/${gateway}?mock=1`);
        }
        if (gateway === "zarinpal") {
          const r = await paymentService.zarinpalRequest({
            amount, callbackUrl,
            description: `بازکردنِ برنامه‌ی تمرین و تغذیه (${plan._id})`,
            mobile: req.user.phone, email: req.user.email || undefined,
          });
          plan.transactionId = r.authority;
          await plan.save();
          return res.redirect(r.url);
        } else {
          const providerId = `PLAN-${plan._id}-${Date.now()}`;
          const r = await paymentService.digipayRequest({ amount, callbackUrl, cellNumber: req.user.phone, providerId });
          plan.transactionId = r.ticket;
          plan.providerId = providerId;
          await plan.save();
          return res.redirect(r.url);
        }
      } catch (gwErr) {
        return this.alertAndReview(req, res, { title: gwErr.message || "خطا در اتصال به درگاه", icon: "error" }, `/program/${plan._id}`);
      }
    } catch (err) {
      next(err);
    }
  }

  // بازگشت از درگاه — تأیید پرداخت و بازکردنِ برنامه (برنامه از قبل ساخته شده)
  async verify(req, res, next) {
    try {
      const plan = await this._own(req);
      if (!plan) return this.alertAndReview(req, res, { title: "برنامه یافت نشد", icon: "error" }, "/program");
      if (plan.unlocked) return res.redirect(`/program/${plan._id}`);

      const { gateway } = req.params;
      const params = { ...(req.query || {}) };
      if (req.method === "POST" && req.body && typeof req.body === "object") Object.assign(params, req.body);

      let verified = false, refId = plan.transactionId;
      if (params.mock === "1" && process.env.NODE_ENV !== "production") {
        verified = true;
      } else if (gateway === "zarinpal") {
        if (params.Status === "OK") {
          const r = await paymentService.zarinpalVerify({ amount: plan.price, authority: params.Authority || plan.transactionId });
          verified = r.ok; refId = r.refId || refId;
        }
      } else if (gateway === "digipay") {
        const cbResult = String(params.result || "").toUpperCase();
        const trackingCode = params.trackingCode || params.trackingcode || params.tracking_code || "";
        const providerId = params.providerId || plan.providerId || undefined;
        if ((!cbResult || cbResult === "SUCCESS") && trackingCode) {
          const r = await paymentService.digipayVerify({ trackingCode, providerId, type: params.type });
          verified = r.ok; refId = r.refId || refId;
        }
      }

      if (!verified)
        return this.alertAndReview(req, res, { title: "پرداخت تأیید نشد یا لغو شد", icon: "error" }, `/program/${plan._id}`);

      plan.unlocked = true;
      plan.refId = refId;
      plan.paidAt = new Date();
      await plan.save();
      return res.redirect(`/program/${plan._id}`);
    } catch (err) {
      next(err);
    }
  }

  // هسته‌ی تولید + ذخیره (شکست را مدیریت می‌کند و true/false برمی‌گرداند)
  async _generate(plan) {
    plan.status = "generating";
    await plan.save();
    try {
      const out = await programService.generateProgram({ intake: plan.toObject(), metrics: plan.metrics });
      plan.title = out.title || "برنامه‌ی اختصاصی من";
      plan.summary = out.summary || "";
      plan.weeklyPlan = Array.isArray(out.weeklyPlan) ? out.weeklyPlan : [];
      plan.nutrition = out.nutrition || undefined;
      plan.supplements = Array.isArray(out.supplements) ? out.supplements : [];
      plan.status = "ready";
      await plan.save();
      return true;
    } catch (e) {
      plan_fail_note(e);
      plan.status = "failed";
      await plan.save();
      return false;
    }
  }

  // نمایشِ برنامه — تا وقتی unlocked نشده فقط پیش‌نمایش (روز اول)
  async view(req, res, next) {
    try {
      const plan = await this._own(req);
      if (!plan) return this.alertAndReview(req, res, { title: "برنامه یافت نشد", icon: "error" }, "/program");
      if (plan.status === "failed")
        return res.render("program/failed", { pageTitle: "ساخت برنامه", noindex: true, plan });

      // در حال ساخت (پس‌زمینه). اگر مدتِ زیادی در این حالت مانده باشد
      // (مثلاً به‌خاطرِ ری‌استارتِ فرآیند) به‌جای معطلیِ بی‌پایان، ناموفق در نظر گرفته می‌شود.
      if (plan.status === "generating" || plan.status === "draft") {
        if (isStaleGenerating(plan))
          return res.render("program/failed", { pageTitle: "ساخت برنامه", noindex: true, plan });
        return res.render("program/generating", { pageTitle: "در حال ساختِ برنامه", noindex: true, plan });
      }

      if (plan.status !== "ready") return res.redirect(`/program`);

      const s = await settingModel.getSingleton();
      return res.render("program/view", {
        pageTitle: plan.title || "برنامه‌ی من",
        noindex: true,
        plan,
        effective: s.programEffectivePrice(),
        price: s.programPrice || 0,
        onSale: s.programEffectivePrice() < (s.programPrice || 0),
      });
    } catch (err) {
      next(err);
    }
  }

  // وضعیتِ ساختِ برنامه (JSON) — برای poll از صفحه‌ی «در حال ساخت»
  async status(req, res, next) {
    try {
      const plan = await this._own(req);
      if (!plan) return res.status(404).json({ status: "notfound" });
      let st = plan.status;
      if ((st === "generating" || st === "draft") && isStaleGenerating(plan))
        st = "failed";
      return res.json({ status: st });
    } catch (err) {
      return res.status(500).json({ status: "error" });
    }
  }

  // خروجیِ PDF — فقط برنامه‌های بازشده.
  // جریان: رندرِ HTML → تولیدِ PDF با هدلس‌کروم → ذخیره روی دیسک → دانلودِ
  // مستقیمِ فایل. اگر نسخه‌ای از قبل ساخته شده و برنامه تغییر نکرده باشد،
  // همان فایلِ ذخیره‌شده دانلود می‌شود (بدونِ تولیدِ دوباره).
  async pdf(req, res, next) {
    try {
      const plan = await this._own(req);
      if (!plan)
        return this.alertAndReview(req, res, { title: "برنامه یافت نشد", icon: "error" }, "/program");
      if (!plan.unlocked || plan.status !== "ready")
        return res.redirect(`/program/${plan._id}`);

      const fs = require("fs");
      const path = require("path");

      const siteName =
        (res.locals.settings && res.locals.settings.siteName) || "فیت ریکس شاپ";
      const name =
        (plan.fullName || `${req.user.firstName || ""} ${req.user.lastName || ""}`).trim() ||
        "کاربر";
      // نامِ فایلِ دانلود (نامِ فارسیِ کاربر) — کاراکترهای غیرمجاز حذف می‌شوند
      const downloadName =
        ("برنامه-" + name).replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60) + ".pdf";

      // فایل در پوشه‌ی خصوصیِ storage ذخیره می‌شود (نه public) تا برنامه‌ی
      // شخصیِ کاربران عمومی نشود. دسترسی از طریقِ همین روتِ محافظت‌شده است.
      const dir = path.join(process.cwd(), "storage", "program-pdfs");
      const filePath = path.join(dir, `${plan._id}.pdf`);

      // کَش: اگر PDF ساخته‌شده جدیدتر از آخرین تغییرِ برنامه باشد، همان را بده
      try {
        const st = fs.statSync(filePath);
        const planTime = plan.updatedAt ? new Date(plan.updatedAt).getTime() : 0;
        if (st && st.size > 0 && st.mtimeMs >= planTime) {
          return res.download(filePath, downloadName);
        }
      } catch (e) {
        /* فایلی نبود — پایین ساخته می‌شود */
      }

      // رندرِ HTMLِ برنامه، سپس تبدیل به PDF
      return res.render(
        "program/pdf",
        { layout: false, plan, user: req.user, siteName },
        async (err, html) => {
          if (err) return next(err);
          try {
            const { htmlToPdf } = require("../../utils/pdf");
            const buf = await htmlToPdf(
              html.replace(/window\.print\(\)/g, "void 0"),
            );

            // ذخیره روی دیسک (خطای ذخیره نباید دانلود را متوقف کند)
            try {
              fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(filePath, buf);
            } catch (wErr) {
              require("../../utils/logError").logError(wErr, {
                source: "program-pdf-save",
              });
            }

            // دانلودِ مستقیمِ فایل
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
              "Content-Disposition",
              "attachment; filename*=UTF-8''" + encodeURIComponent(downloadName),
            );
            return res.send(buf);
          } catch (e) {
            require("../../utils/logError").logError(e, { source: "program-pdf" });
            return this.alertAndReview(
              req,
              res,
              { title: "ساختِ فایل PDF ناموفق بود؛ چند لحظه بعد دوباره تلاش کن", icon: "error" },
              `/program/${plan._id}`,
            );
          }
        },
      );
    } catch (err) {
      next(err);
    }
  }

  // پرسش‌وپاسخ (فقط برنامه‌های بازشده)
  async ask(req, res, next) {
    try {
      const plan = await this._own(req);
      if (!plan) return res.status(404).json({ success: false, message: "برنامه یافت نشد" });
      if (!plan.unlocked || plan.status !== "ready")
        return res.status(403).json({ success: false, message: "این قابلیت پس از بازکردنِ برنامه فعال است" });

      const question = String((req.body || {}).question || "").trim();
      if (!question) return res.status(400).json({ success: false, message: "سوالی وارد نشده" });
      if ((plan.qa || []).length >= 20)
        return res.status(429).json({ success: false, message: "سقفِ پرسش‌وپاسخِ این برنامه پر شده است" });

      const answer = await programService.askAboutProgram({ plan: plan.toObject(), question });
      plan.qa.push({ q: question.slice(0, 1000), a: answer });
      await plan.save();
      return res.json({ success: true, answer });
    } catch (err) {
      return res.status(502).json({ success: false, message: "پاسخ‌گویی ناموفق بود؛ دوباره تلاش کن" });
    }
  }

  // فهرستِ برنامه‌های کاربر
  async mine(req, res, next) {
    try {
      const plans = await ProgramPlan.find({ user: req.user._id, status: "ready" })
        .sort({ createdAt: -1 })
        .select("title unlocked createdAt")
        .lean();
      return res.render("program/mine", { pageTitle: "برنامه‌های من", noindex: true, plans });
    } catch (err) {
      next(err);
    }
  }
}

function plan_fail_note(err) {
  try { require("../../utils/logError").logError(err, { source: "program" }); } catch {}
}

// آیا برنامه مدتِ زیادی در حالتِ «در حال ساخت» مانده؟ (تولیدِ عادی خیلی زودتر
// تمام می‌شود؛ این فقط برای موارد نادرِ ری‌استارتِ فرآیندِ حینِ تولید است)
function isStaleGenerating(plan) {
  const t = plan && plan.updatedAt ? new Date(plan.updatedAt).getTime() : 0;
  return t > 0 && Date.now() - t > 5 * 60 * 1000;
}

module.exports = new programController();
