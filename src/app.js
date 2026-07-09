const express = require("express");
const app = express();
const mongoose = require("mongoose");
const http = require("http");
require("dotenv").config();
const { SERVER_PORT } = process.env;
const { DATABASE_MONGODB_URL } = process.env;
const createError = require("http-errors");
const { AllRouters } = require("./routers/router");
const cookieParser = require("cookie-parser");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");
const Helpers = require("./Helpers");
const session = require("express-session");
const { refreshExchangeRate } = require("./services/exchangeRate.service");
const { startExchangeRateCron } = require("./jobs/exchangeRate.job");
const GlobalData = require("./middlewares/globalData");
const flash = require("./middlewares/flash.middleware");
const MongoStore = require("connect-mongo");
const helmet = require("helmet");
const create =
  MongoStore.create || (MongoStore.default && MongoStore.default.create);

module.exports = class Application {
  constructor() {
    this.configServer();
    this.createServer();
    this.createMongodb();
    this.exchangeRate();
    this.createRoutes();
    this.errorHandler();
  }

  configServer() {
    app.set("trust proxy", true);
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      }),
    );
    app.use(express.json({ limit: "100mb" }));
    app.use(express.urlencoded({ limit: "100mb", extended: true }));
    app.use(cookieParser());

    app.use(
      session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        store: create
          ? create({ mongoUrl: process.env.DATABASE_MONGODB_URL, ttl: 86400 })
          : new (MongoStore(session))({
              url: process.env.DATABASE_MONGODB_URL,
              ttl: 86400,
            }),
        cookie: { maxAge: 24 * 60 * 60 * 1000 },
      }),
    );
    app.use(flash);
    app.use((req, res, next) => {
      res.locals.success_msg = req.flash("success_msg");
      res.locals.error_msg = req.flash("error_msg");
      next();
    });
    app.use(express.static(path.join(__dirname, "..", "public")));
    app.set("view engine", "ejs");
    app.set("views", path.resolve("./resource/views"));
    app.use(expressLayouts);
    app.set("layout extractScripts", true);
    app.set("layout extractStyles", true);
    app.set("layout", "home/master");
    app.use((req, res, next) => {
      app.locals = new Helpers(req, res).getObjects();
      next();
    });
  }

  createServer() {
    const server = http.createServer(app);
    server.listen(SERVER_PORT, () =>
      console.log(`server run to PORT : ${SERVER_PORT}`),
    );
  }

  createMongodb() {
    mongoose.connect(DATABASE_MONGODB_URL, { autoIndex: true });
    mongoose.set("strictPopulate", true);
    mongoose.set("strictQuery", true);
    mongoose.connection.on("connected", async () => {
      console.log(`connect to mongodb `);
      try {
        const coll = mongoose.connection.db.collection("baskets");
        const indexes = await coll.indexes();
        if (indexes.some((i) => i.name === "user_1")) {
          await coll.dropIndex("user_1");
          console.log("dropped legacy baskets.user_1 unique index");
        }
      } catch (e) {
        console.log("basket index cleanup skipped:", e.message);
      }
    });
    mongoose.connection.on("desconnected", () =>
      console.log(`desconnect to mongodb `),
    );
  }

  createRoutes() {
    app.use(GlobalData.init());
    app.use(AllRouters);
  }

  exchangeRate() {
    // یک‌بار در زمان بوت نرخِ مرجعِ درهم را تازه می‌کنیم و سپس طبق زمان‌بندیِ
    // کرون. این فقط نرخِ ذخیره‌شده را به‌روز می‌کند و قیمتِ محصولات را
    // خودکار بازنویسی نمی‌کند (قیمت‌ها همچنان از پنل ادمین کنترل می‌شوند).
    refreshExchangeRate().catch((e) =>
      console.error("خطا در به‌روزرسانی اولیه‌ی نرخ ارز:", e.message),
    );
    startExchangeRateCron();
  }

  errorHandler() {
    app.use((req, res, next) => {
      next(createError.NotFound("آدرس مورد نظر پیدا نشد"));
    });
    app.use((error, req, res, next) => {
      if (error.code === "LIMIT_FILE_SIZE")
        return res
          .status(400)
          .json({ message: "حجم فایل نباید بیشتر از 3 مگابایت باشد." });
      const serverError = createError.InternalServerError(error);
      const status = error.status || serverError.status;
      const isProd = process.env.NODE_ENV === "production";
      // در production جزئیاتِ خطای داخلی به کاربر نشت نکند
      const message =
        isProd && status >= 500
          ? "خطای داخلی سرور رخ داد. لطفاً بعداً تلاش کنید."
          : error.message || serverError.message;

      if (status >= 500) console.error("Server error:", error);

      // برای درخواست‌های مرورگر، صفحه‌ی ۴۰۴ واقعی (کد وضعیت درست برای سئو)
      if (status === 404 && req.accepts("html")) {
        return res.status(404).render("home/404", {
          pageTitle: "صفحه پیدا نشد",
          noindex: true,
        });
      }

      // خطای سرور روی صفحه‌ی مرورگر → صفحه‌ی خطای دوستانه (نه JSON خام)
      if (req.accepts("html") && status >= 500) {
        return res
          .status(status)
          .type("html")
          .send(
            '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">' +
              '<meta name="viewport" content="width=device-width,initial-scale=1">' +
              "<title>خطای سرور</title><style>body{font-family:Tahoma,sans-serif;" +
              "background:#f8fafc;color:#1f2937;display:flex;min-height:100vh;align-items:" +
              "center;justify-content:center;margin:0}.box{text-align:center;padding:2rem}" +
              ".box h1{font-size:3.2rem;margin:0 0 .5rem;color:#ef4444}a{color:#2563eb;" +
              "text-decoration:none}</style></head><body><div class=\"box\"><h1>۵۰۰</h1>" +
              "<p>متأسفانه خطایی رخ داد. لطفاً چند لحظه بعد دوباره تلاش کنید.</p>" +
              '<a href="/">بازگشت به صفحه اصلی</a></div></body></html>',
          );
      }

      return res.status(status).json({ message: message });
    });
  }
};
