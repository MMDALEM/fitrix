const Joi = require("joi");

const authSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .pattern(/^09\d{9}$/)
    .required()
    .messages({
      "string.base": "شماره تلفن باید متن باشد",
      "string.empty": "شماره تلفن نمیتواند خالی بماند",
      "string.pattern.base": "شماره موبایل معتبر نیست",
      "any.required": "شماره تلفن الزامی است",
    }),
});

const profileSchema = Joi.object({
  username: Joi.string().min(3).max(50).allow("").messages({
    "string.min": "Username cannot be less than 3 characters",
    "string.max": "Username cannot be more than 50 characters",
  }),
  firstName: Joi.string().max(20).allow("").messages({
    "string.max": "firstName cannot be more than 20 characters",
  }),
  lastName: Joi.string().max(20).allow("").messages({
    "string.max": "lastName cannot be more than 20 characters",
  }),
});

const authAdminSchema = Joi.object({
  username: Joi.string().min(3).max(50).required().messages({
    "string.min": "نام کاربری نمیتواند کمتر از 3 کاراکتر باشد",
    "string.max": "نام کاربری نمیتواند بیشتر از 50 کاراکتر باشد",
    "string.empty": "نام کاربری نمیتواند خالی بماند",
  }),
  password: Joi.string().min(3).max(50).required().messages({
    "string.min": "رمز عبور نمیتواند کمتر از 3 کاراکتر باشد",
    "string.max": "رمز عبور نمیتواند بیشتر از 50 کاراکتر باشد",
    "string.empty": "رمز عبور نمیتواند خالی بماند",
  }),
});

module.exports = { authSchema, profileSchema, authAdminSchema };
