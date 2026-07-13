const mongoose = require("mongoose");
const userModel = require("../../../models/user.model");
const basketModel = require("../../../models/basket.model");
const addressModel = require("../../../models/address.model");
const controller = require("../../.controller");

const PAGE_SIZE = 20;

const isSuperAdmin = (u) => {
  const roles = u && (Array.isArray(u.roles) ? u.roles : [u.roles]);
  return !!roles && roles.includes("SUPER_ADMIN");
};

class userAdminController extends controller {
  // لیست کاربران با جستجو و صفحه‌بندی + تعداد سفارش و مبلغ خرید هر کاربر
  async index(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const q = (req.query.q || "").toString().trim();

      // فیلترِ جستجو: نام، شماره، ایمیل، نام‌کاربری
      const filter = {};
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [
          { firstName: rx },
          { lastName: rx },
          { phone: rx },
          { email: rx },
          { username: rx },
        ];
      }

      const total = await userModel.countDocuments(filter);
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const current = Math.min(page, pages);

      const users = await userModel
        .find(filter, "firstName lastName phone email roles isActive createdAt lastLogin")
        .sort({ createdAt: -1 })
        .skip((current - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean();

      // آمار سفارش‌های پرداخت‌شده‌ی همین کاربرانِ صفحه (تعداد + مبلغ)
      const ids = users.map((u) => u._id);
      const stats = await basketModel.aggregate([
        { $match: { status: "paid", user: { $in: ids } } },
        {
          $group: {
            _id: "$user",
            orders: { $sum: 1 },
            spent: { $sum: { $ifNull: ["$finalPrice", 0] } },
          },
        },
      ]);
      const statMap = new Map(stats.map((s) => [String(s._id), s]));
      users.forEach((u) => {
        const s = statMap.get(String(u._id));
        u.ordersCount = s ? s.orders : 0;
        u.totalSpent = s ? s.spent : 0;
      });

      // آمار کلی بالای صفحه
      const [totalUsers, activeUsers, adminUsers] = await Promise.all([
        userModel.countDocuments({}),
        userModel.countDocuments({ isActive: true }),
        userModel.countDocuments({ roles: { $in: ["ADMIN", "SUPER_ADMIN"] } }),
      ]);

      return res.render("admin/user/index", {
        users,
        q,
        current,
        pages,
        total,
        pageSize: PAGE_SIZE,
        counts: { totalUsers, activeUsers, adminUsers },
        isSuper: isSuperAdmin(req.user),
      });
    } catch (err) {
      next(err);
    }
  }

  // جزئیات یک کاربر + سفارش‌ها + آدرس‌ها
  async detail(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return this.alertAndBack(req, res, {
          title: "شناسه کاربر معتبر نیست",
          icon: "error",
        });

      const user = await userModel.findById(id).lean();
      if (!user)
        return this.alertAndBack(req, res, {
          title: "کاربر یافت نشد",
          icon: "error",
        });

      const orders = await basketModel
        .find({ user: id, status: "paid" })
        .sort({ paidAt: -1 })
        .select("orderNumber finalPrice paidAt statusLabel items")
        .lean();

      const addresses = await addressModel.find({ user: id }).lean();

      const totalSpent = orders.reduce(
        (s, o) => s + (o.finalPrice || 0),
        0,
      );

      return res.render("admin/user/detail", {
        user,
        orders,
        addresses,
        totalSpent,
        isSuper: isSuperAdmin(req.user),
      });
    } catch (err) {
      next(err);
    }
  }

  // فعال/مسدود کردن کاربر
  async toggleActive(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return this.alertAndBack(req, res, {
          title: "شناسه کاربر معتبر نیست",
          icon: "error",
        });

      const user = await userModel.findById(id);
      if (!user)
        return this.alertAndBack(req, res, { title: "کاربر یافت نشد", icon: "error" });

      // نگهبان‌ها: خودِ ادمین و سوپرادمین را نمی‌توان مسدود کرد
      if (String(user._id) === String(req.user._id))
        return this.alertAndBack(req, res, {
          title: "نمی‌توانید حساب خودتان را مسدود کنید",
          icon: "error",
        });
      const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
      if (roles.includes("SUPER_ADMIN"))
        return this.alertAndBack(req, res, {
          title: "حساب سوپرادمین قابل مسدودسازی نیست",
          icon: "error",
        });

      user.isActive = !user.isActive;
      // با مسدودسازی، نشستِ فعال کاربر هم باطل می‌شود
      if (!user.isActive) user.refreshTokenHash = null;
      await user.save();

      return this.alertAndBack(req, res, {
        title: user.isActive
          ? "کاربر فعال شد"
          : "کاربر مسدود شد (دسترسی‌اش قطع شد)",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }

  // تغییر نقش (ادمین کردن / برداشتن ادمین) — فقط توسط سوپرادمین
  async setRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role } = req.body; // "ADMIN" یا "USER"

      const actorRoles = Array.isArray(req.user.roles)
        ? req.user.roles
        : [req.user.roles];
      if (!actorRoles.includes("SUPER_ADMIN"))
        return this.alertAndBack(req, res, {
          title: "فقط سوپرادمین می‌تواند نقش‌ها را تغییر دهد",
          icon: "error",
        });

      if (!["ADMIN", "USER"].includes(role))
        return this.alertAndBack(req, res, {
          title: "نقش نامعتبر است",
          icon: "error",
        });

      if (!mongoose.Types.ObjectId.isValid(id))
        return this.alertAndBack(req, res, {
          title: "شناسه کاربر معتبر نیست",
          icon: "error",
        });

      const user = await userModel.findById(id);
      if (!user)
        return this.alertAndBack(req, res, { title: "کاربر یافت نشد", icon: "error" });

      const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
      if (roles.includes("SUPER_ADMIN"))
        return this.alertAndBack(req, res, {
          title: "نقشِ سوپرادمین قابل تغییر نیست",
          icon: "error",
        });

      user.roles = [role];
      user.isAdmin = role === "ADMIN";
      await user.save();

      return this.alertAndBack(req, res, {
        title: role === "ADMIN" ? "کاربر ادمین شد" : "دسترسی ادمین برداشته شد",
        icon: "success",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new userAdminController();
