const express = require('express');
const app = express();
const mongoose = require('mongoose');
const http = require('http');
require('dotenv').config();
const { SERVER_PORT } = process.env;
const { DATABASE_MONGODB_URL } = process.env;
const createError = require('http-errors');
const { AllRouters } = require('./routers/router');
const cookieParser = require('cookie-parser');
const expressLayouts = require("express-ejs-layouts");
const path = require('path');
const Helpers = require('./Helpers');
// const flash = require('connect-flash');
const session = require('express-session');
const { updateExchangeRate } = require('./services/exchangeRate.service');
const { startExchangeRateCron } = require('./jobs/exchangeRate.job');
const GlobalData = require("./middlewares/globalData");
const flash = require('./middlewares/flash.middleware');

module.exports = class Application {
  constructor() {
    this.configServer();
    this.createServer();
    this.createMongodb();
    this.createRoutes();
    this.errorHandler();
  }

  configServer() {
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json({ limit: '1024mb' }));
    app.use(cookieParser());
    app.use(session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      cookie: { maxAge: 24 * 60 * 60 * 1000 }
    }));
    app.use(flash);
    // app.use(flash());
    app.use((req, res, next) => {
      res.locals.success_msg = req.flash('success_msg');
      res.locals.error_msg = req.flash('error_msg');
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
    server.listen(SERVER_PORT, () => console.log(`server run to PORT : ${SERVER_PORT}`));
  }

  createMongodb() {
    mongoose.connect(DATABASE_MONGODB_URL,{autoIndex: true});
    mongoose.set('strictPopulate', true);
    mongoose.set('strictQuery', true);
    mongoose.connection.on('connected', () => console.log(`connect to mongodb `));
    mongoose.connection.on('desconnected', () => console.log(`desconnect to mongodb `));
  }

  createRoutes() {
    app.use(GlobalData.init());
    app.use(AllRouters);
  }
  
  exchangeRate(){
    updateExchangeRate();
    startExchangeRateCron();
  }

  errorHandler() {
    app.use((req, res, next) => {
      next(createError.NotFound('آدرس مورد نظر پیدا نشد'));
    });
    app.use((error, req, res, next) => {
      if (error.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ message: 'حجم فایل نباید بیشتر از 3 مگابایت باشد.' });
      const serverError = createError.InternalServerError(error);
      const message = error.message || serverError.message;
      const status = error.status || serverError.status;
      return res.status(status).json({ message: message });
    });
  }
};
