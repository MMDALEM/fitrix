const JWT = require('jsonwebtoken');
const userModel= require('../models/user.model');
const { verifyCookie } = require('../utils/function');

exports.backTokenAuth = async (req, res, next) => {
  try {
    const token = req.cookies.fitrix_token;
    if (!token) return next();
    JWT.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_USER, async (err, paylod) => {
      if (err) return res.redirect("/auth");
      const check = await verifyCookie(paylod.id,res);
      if(!check) return next();
      const user = await userModel.findById(paylod.id, { phone:1 , isActive:1 , role:1 });
      if (!user){ console.log("err"); return res.redirect("/");}
      req.user = user;
      return res.redirect("/dashboard");
    });
  } catch (err) {
    next(err);
  }
};


