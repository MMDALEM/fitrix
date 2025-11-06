const JWT = require('jsonwebtoken');
const { sendError, sendSuccess } = require('../utils/res');
const adminModel= require('../models/admin.model');


exports.verifyUser = async (req, res, next) => {
  try {
    const token = req.cookies.qtoken;
    if (!token) return res.redirect("/login");
    JWT.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_ADMIN , async (err, paylod) => {
      if (err) return res.redirect("/login");
      const user = await userModel.findById(paylod.id, { phone:1 , isActive:1 , role:1 });
      if (!user) return res.redirect("/login");
      req.user = user;
      next();
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyAdmin = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) 
            return res.redirect("/login");
        
        let user = null;
        JWT.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_USER , async (err, paylod) => {
            if (err) return res.redirect("/login");
            user = await userModel.findById(paylod.id, { phone:1 , isActive:1 , role:1 });
            if (!user) return res.redirect("/login");
            req.user = user;
        });

        if(user.role === 'admin') return res.redirect("/admin");
        else return res.redirect("/");
    } catch (err) {
        next(err);
    }
};