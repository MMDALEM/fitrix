const JWT = require('jsonwebtoken');
const userModel= require('../models/user.model');

exports.verifyTokenPublic = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return next();
    JWT.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_USER, async (err, paylod) => {
      if (err) return res.redirect("/auth");
      const user = await userModel.findById(paylod.id, { phone:1 , isActive:1 , role:1 });
      if (!user) { console.log("err"); return res.redirect("/");} 
      req.user = user;
      next();
    });
  } catch (err) {
    next(err);
  }
};
