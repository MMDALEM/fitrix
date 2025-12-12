const Randomstring = require('randomstring');
const userModel = require('../models/user.model');
const JWT = require('jsonwebtoken');

exports.generateOtp = () => {
    return Math.floor(10000 + Math.random() * 90000);
}

exports.generateRandomNumber = () => {
    return Math.floor(100000 + Math.random() * 900000);
}

exports.jwtSign = (id) =>{
    return new Promise(async (resolve, reject) => {
      const user = await userModel.findById(id);
      if(!user)return res.status(401).json({message:"خطا اعتبارسنجی کاربر"})
      JWT.sign({ id: user._id , phone:user.phone }, process.env.JWT_ACCESS_TOKEN_SECRET_USER, { expiresIn: '1y' }, async (err, token) => {
        if (err) reject(err.message);
        user.token = token;
        await user.save();
        resolve(token);
      });
    });
}

exports.jwtSignAdmin = (id) =>{
    return new Promise(async (resolve, reject) => {
      const user = await userModel.findById(id);
      JWT.sign({ id: id }, process.env.JWT_ACCESS_TOKEN_SECRET_USER, { expiresIn: '1y' }, async (err, token) => {
        if (err) reject(err.message);
        user.token = token;
        await user.save();
        resolve(token);
      });
    });
}

exports.verifyCookie = async (id , res) =>{
    const user = await userModel.findById(id);
    if(!user) {
        res.clearCookie('fitrix_token', {
        httpOnly: process.env.NODE_ENV === 'production',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : ""
      });
      return false;
    }
    return true;
}

exports.slug = async () =>{
    return Randomstring.generate({
        length: 12,
        charset: 'alphanumeric',
        capitalization: 'lowercase'
    });
}

