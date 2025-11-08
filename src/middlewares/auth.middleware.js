const JWT = require('jsonwebtoken');
const userModel= require('../models/user.model');

exports.verifyUser = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.redirect("/auth");
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

exports.verifyAdmin = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) 
            return res.redirect("/auth");
        
        let user = null;
        JWT.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_MANAGER, async (err, paylod) => {
            if (err) return res.redirect("/auth");
            user = await userModel.findById(paylod.id, { phone:1 , isActive:1 , isAdmin:1 });
            if (!user) return res.redirect("/auth");
            if(user.role !== 'ADMIN') return res.redirect("/");
            req.user = user;
            next();
        });

        if(user.role === 'ADMIN') return res.redirect("/admin");
        else return res.redirect("/");
    } catch (err) {
        next(err);
    }
};