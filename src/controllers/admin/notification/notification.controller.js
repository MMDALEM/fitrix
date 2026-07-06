const mongoose = require("mongoose");
const notificationModel = require("../../../models/notification.model");
const controller = require("../../.controller");

class notificationController extends controller {
  async index(req, res, next) {
    try {
      const notifications = await notificationModel
        .find({ audience: "admin" })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      // همه را خوانده‌شده علامت بزن (بعد از باز کردن صفحه)
      await notificationModel.updateMany(
        { audience: "admin", isRead: false },
        { $set: { isRead: true } },
      );

      const unread = 0; // بعد از باز شدن صفحه، خوانده‌نشده صفر می‌شود
      return res.render("admin/notification/index", { notifications, unread });
    } catch (err) {
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      if (mongoose.Types.ObjectId.isValid(id)) {
        await notificationModel.findByIdAndDelete(id);
      }
      return this.alertAndBack(req, res, {
        title: "اعلان حذف شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  async clearAll(req, res, next) {
    try {
      await notificationModel.deleteMany({ audience: "admin" });
      return this.alertAndBack(req, res, {
        title: "همه اعلان‌ها پاک شدند",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new notificationController();
