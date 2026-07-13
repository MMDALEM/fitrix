const errorLogModel = require("../../../models/errorLog.model");
const controller = require("../../.controller");

const PAGE_SIZE = 30;

class logAdminController extends controller {
  async index(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const onlyUnread = req.query.unread === "1";

      const filter = {};
      if (onlyUnread) filter.isRead = false;

      const total = await errorLogModel.countDocuments(filter);
      const unread = await errorLogModel.countDocuments({ isRead: false });
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const current = Math.min(page, pages);

      const logs = await errorLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((current - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("user", "phone firstName lastName")
        .lean();

      return res.render("admin/log/index", {
        logs,
        current,
        pages,
        total,
        unread,
        onlyUnread,
        pageSize: PAGE_SIZE,
      });
    } catch (err) {
      next(err);
    }
  }

  async markAllRead(req, res, next) {
    try {
      await errorLogModel.updateMany({ isRead: false }, { $set: { isRead: true } });
      return this.alertAndBack(req, res, {
        title: "همه‌ی خطاها خوانده‌شده علامت خوردند",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  async clearAll(req, res, next) {
    try {
      await errorLogModel.deleteMany({});
      return this.alertAndBack(req, res, {
        title: "همه‌ی خطاها پاک شدند",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteOne(req, res, next) {
    try {
      await errorLogModel.findByIdAndDelete(req.params.id);
      return this.alertAndBack(req, res, {
        title: "خطا حذف شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new logAdminController();
