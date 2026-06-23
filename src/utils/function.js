const Randomstring = require("randomstring");
const userModel = require("../models/user.model");
const JWT = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const https = require("https");

exports.generateOtp = () => {
  return Math.floor(10000 + Math.random() * 90000);
};

exports.generateRandomNumber = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

exports.jwtSign = (id) => {
  return new Promise(async (resolve, reject) => {
    const user = await userModel.findById(id);
    if (!user) return res.status(401).json({ message: "خطا اعتبارسنجی کاربر" });
    JWT.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_ACCESS_TOKEN_SECRET_USER,
      { expiresIn: "1y" },
      async (err, token) => {
        if (err) reject(err.message);
        user.token = token;
        await user.save();
        resolve(token);
      },
    );
  });
};

exports.jwtSignAdmin = (id) => {
  return new Promise(async (resolve, reject) => {
    const user = await userModel.findById(id);
    JWT.sign(
      { id: id },
      process.env.JWT_ACCESS_TOKEN_SECRET_USER,
      { expiresIn: "1y" },
      async (err, token) => {
        if (err) reject(err.message);
        user.token = token;
        await user.save();
        resolve(token);
      },
    );
  });
};

exports.verifyCookie = async (id, res) => {
  const user = await userModel.findById(id);
  if (!user) {
    res.clearCookie("fitrix_token", {
      httpOnly: process.env.NODE_ENV === "production",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      domain:
        process.env.NODE_ENV === "production" ? process.env.COOKIE_DOMAIN : "",
    });
    return false;
  }
  return true;
};

exports.randomString = () => {
  return Randomstring.generate({
    length: 12,
    charset: "alphanumeric",
    capitalization: "lowercase",
  });
};

exports.hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

exports.comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

exports.sendCode = async (phone, code) => {
  console.log(typeof phone, typeof code);
  console.log(typeof phone, code);

  const data = JSON.stringify({
    bodyId: 469148,
    to: phone,
    args: [code],
  });

  const options = {
    hostname: "console.melipayamak.com",
    port: 443,
    path: "/api/send/shared/1fa3df8e7b374542b04e216196e18fe7",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  const req = https.request(options, (res) => {
    console.log("statusCode: " + res.statusCode);

    res.on("data", (d) => {
      process.stdout.write(d);
    });
  });

  req.on("error", (error) => {
    console.error(error);
  });

  req.write(data);
  req.end();
};
