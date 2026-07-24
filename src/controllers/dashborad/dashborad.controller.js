const addressModel = require("../../models/address.model");
const basketModel = require("../../models/basket.model");
const userModel = require("../../models/user.model");
const notificationModel = require("../../models/notification.model");
const controller = require("../.controller");

class dashboradController extends controller {
  async dashborad(req, res, next) {
    try {
      const addresses = await addressModel.find({ user: req.user._id });

      // سفارش‌های کاربر = سبدهای پرداخت‌شده (به ترتیب جدیدترین)
      const orders = await basketModel
        .find({ user: req.user._id, status: "paid" })
        .populate("items.product", "title image slug")
        .sort({ paidAt: -1 });

      // پیام‌های کاربر (تشکر از خرید و ...)
      const notifications = await notificationModel
        .find({ audience: "user", user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      // اطلاعات کامل کاربر (برای فرم ویرایش پروفایل)
      const profile = await userModel
        .findById(req.user._id, "firstName lastName email phone")
        .lean();

      return res.render("dashborad/dashborad", {
        addresses,
        orders,
        notifications,
        profile: profile || {},
        pageTitle: "حساب کاربری",
        noindex: true,
      });
    } catch (err) {
      next(err);
    }
  }

  async accountinfo(req, res, next) {
    try {
      const profile = await userModel
        .findById(req.user._id, "firstName lastName email phone")
        .lean();

      return res.render("dashborad/account", {
        profile: profile || {},
        pageTitle: "حساب کاربری",
        noindex: true,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { firstName, lastName, email } = req.body;

      if (email && !/^\S+@\S+\.\S+$/.test(email))
        return this.alertAndBack(req, res, {
          title: "ایمیل معتبر نیست",
          icon: "error",
        });

      await userModel.updateOne(
        { _id: req.user._id },
        {
          $set: {
            firstName: (firstName || "").trim().slice(0, 50),
            lastName: (lastName || "").trim().slice(0, 50),
            email: (email || "").trim().toLowerCase(),
          },
        },
      );

      return this.alertAndBack(req, res, {
        title: "اطلاعات حساب با موفقیت ذخیره شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  async orders(req, res, next) {
    try {
      const orders = await basketModel
        .find({ user: req.user._id, status: { $in: ["paid", "cancelled"] } })
        .populate("items.product", "title image slug")
        .sort({ paidAt: -1, updatedAt: -1 })
        .lean();

      return res.render("dashborad/orders", {
        orders,
        pageTitle: "سفارش‌های من",
        noindex: true,
      });
    } catch (err) {
      next(err);
    }
  }

  async orderDetail(req, res, next) {
    try {
      const mongoose = require("mongoose");
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return res.redirect("/dashboard/orders");

      const order = await basketModel
        .findOne({ _id: id, user: req.user._id })
        .populate("items.product", "title image slug")
        .lean();

      if (!order) return res.redirect("/dashboard/orders");

      return res.render("dashborad/order-detail", {
        order,
        pageTitle: `سفارش ${order.orderNumber || ""}`,
        noindex: true,
      });
    } catch (err) {
      next(err);
    }
  }

  async address(req, res, next) {
    try {
      const addresses = await addressModel.find({ user: req.user._id });
      return res.render("dashborad/address", {
        addresses,
        pageTitle: "آدرس‌های من",
        noindex: true,
      });
    } catch (err) {
      next(err);
    }
  }

  async addAddress(req, res, next) {
    try {
      const { title, state, city, address, postalCode, receiver, phone } =
        req.body;
      // همه‌ی فیلدها اجباری‌اند (به‌ویژه استان و شهر)
      if (
        !title ||
        !state ||
        !city ||
        !address ||
        !postalCode ||
        !receiver ||
        !phone
      )
        return this.alertAndBack(req, res, {
          title: "لطفا تمام فیلدها از جمله استان و شهر را پر کنید",
          icon: "error",
        });

      await addressModel.create({
        title,
        state,
        city,
        address,
        postalCode,
        receiver,
        phone,
        user: req.user._id,
      });

      return this.alertAndBack(req, res, {
        title: "آدرس با موفقیت اضافه شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  async addAddressAjax(req, res, next) {
    try {
      const { title, state, city, address, postalCode, receiver, phone } =
        req.body;
      if (
        !title ||
        !state ||
        !city ||
        !address ||
        !postalCode ||
        !receiver ||
        !phone
      )
        return res.status(400).json({
          success: false,
          message: "لطفا تمام فیلدها از جمله استان و شهر را پر کنید",
        });

      const doc = await addressModel.create({
        title,
        state,
        city,
        address,
        postalCode,
        receiver,
        phone,
        user: req.user._id,
      });

      return res.json({
        success: true,
        message: "آدرس با موفقیت اضافه شد",
        address: {
          _id: doc._id,
          title: doc.title,
          state: doc.state,
          city: doc.city,
          address: doc.address,
          receiver: doc.receiver,
          phone: doc.phone,
          postalCode: doc.postalCode,
        },
      });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "خطا در ثبت آدرس" });
    }
  }

  async deleteAddress(req, res, next) {
    try {
      const { id } = req.params;
      if (!id)
        return this.alertAndBack(req, res, {
          title: "آدرس مورد نظر یافت نشد",
          icon: "error",
        });

      await addressModel.findByIdAndDelete(id);

      return this.alertAndBack(req, res, {
        title: "آدرس با موفقیت حذف شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new dashboradController();
