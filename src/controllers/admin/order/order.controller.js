const mongoose = require("mongoose");
const basketModel = require("../../../models/basket.model");
const controller = require("../../.controller");

const ITEM_SELECT = "title image slug priceSingle flavor weight";

class adminOrderController extends controller {
  // لیست سفارش‌ها (سبدهای پرداخت‌شده)
  // ?filter=new   -> پرداخت‌شده و هنوز ارسال‌نشده
  // ?filter=shipped -> ارسال‌شده
  async orders(req, res, next) {
    try {
      const { filter } = req.query;
      const programPlanModel = require("../../../models/programPlan.model");

      const counts = {
        all: await basketModel.countDocuments({ status: "paid" }),
        new: await basketModel.countDocuments({
          status: "paid",
          isShipped: false,
        }),
        shipped: await basketModel.countDocuments({
          status: "paid",
          isShipped: true,
        }),
        programs: await programPlanModel.countDocuments({
          unlocked: true,
          price: { $gt: 0 },
        }),
      };

      // تبِ «برنامه‌ها» — فهرستِ کسانی که نسخه‌ی کاملِ برنامه را خریده‌اند
      if (filter === "programs") {
        const programs = await programPlanModel
          .find({ unlocked: true, price: { $gt: 0 } })
          .populate("user", "phone firstName lastName")
          .sort({ paidAt: -1 })
          .lean();
        return res.render("admin/order/index", {
          orders: [],
          programs,
          counts,
          filter: "programs",
        });
      }

      const query = { status: "paid" };
      if (filter === "new") query.isShipped = false;
      else if (filter === "shipped") query.isShipped = true;

      const orders = await basketModel
        .find(query)
        .populate("items.product", ITEM_SELECT)
        .populate("user", "phone firstName lastName")
        .sort({ paidAt: -1 });

      return res.render("admin/order/index", {
        orders,
        programs: [],
        counts,
        filter: filter || "all",
      });
    } catch (err) {
      next(err);
    }
  }

  // ثبت ارسال سفارش (تیک ارسال)
  async ship(req, res, next) {
    try {
      const { id } = req.params;
      const { trackingCode, shippingNote } = req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id))
        return this.alertAndBack(req, res, {
          title: "شناسه سفارش نامعتبر است",
          icon: "error",
        });

      const order = await basketModel.findOne({ _id: id, status: "paid" });
      if (!order)
        return this.alertAndBack(req, res, {
          title: "سفارش یافت نشد",
          icon: "error",
        });

      await order.markShipped(trackingCode, shippingNote);

      return this.alertAndBack(req, res, {
        title: "سفارش با موفقیت «ارسال‌شده» ثبت شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  // برچسب پستی قابل چاپ
  async label(req, res, next) {
    try {
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) return next();

      const order = await basketModel
        .findOne({ _id: id, status: "paid" })
        .populate("items.product", ITEM_SELECT)
        .populate("user", "phone firstName lastName");

      if (!order) return next();

      // برچسب بدون منوی ادمین چاپ شود
      res.locals.layout = "admin/master";
      return res.render("admin/order/label", { order });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new adminOrderController();
