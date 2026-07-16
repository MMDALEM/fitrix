const router = require("express").Router();
const { verifyUser, verifyAdmin } = require("../middlewares/auth.middleware");
const { verifyTokenPublic } = require("../middlewares/authPublic.middleware");
const { checkBasketAccess } = require("../middlewares/basket.middleware");
const { logout } = require("../controllers/auth/auth.controller");

const homeRouter = require("./home/home.route");
router.use("/", homeRouter);

const productRouter = require("./product/product.route");
router.use("/product", productRouter);

const authRouter = require("./auth/auth.route");
router.use("/auth", authRouter);

const shopRouter = require("./shop/shop.route");
router.use("/shop", verifyTokenPublic, shopRouter);

const consultRouter = require("./consult/consult.route");
router.use("/consult", consultRouter);

const programRouter = require("./program/program.route");
router.use("/program", verifyUser, programRouter);

// بدن‌شناسی — نقشه‌ی تعاملیِ عضلات + تفاوتِ تیپ‌های بدنی (عمومی، برای سئو)
router.get("/anatomy", (req, res) => {
  const siteUrl = `${req.protocol}://${req.get("host")}`;
  res.render("anatomy/index", {
    pageTitle: "بدن‌شناسی و آناتومی عضلات",
    metaDescription:
      "نقشه‌ی تعاملیِ عضلاتِ بدن (آقا و خانم) و تفاوتِ تیپ‌های بدنی اکتومورف، مزومورف و اندومورف — آموزشِ رایگانِ فیت‌ریکس.",
    canonicalUrl: `${siteUrl}/anatomy`,
  });
});

const basketRouter = require("./shop/basket.route");
router.use("/basket", checkBasketAccess, basketRouter);

const paymentRouter = require("./payment/shop.route");
router.use("/", paymentRouter);

const dashboardRouter = require("./dashboard/dashboard.route");
router.use("/dashboard", verifyUser, dashboardRouter);

const adminRouter = require("./admin/admin.route");
router.use("/admin", adminRouter);

const productAdminRouter = require("./admin/product.route");
router.use("/admin/product", verifyAdmin, productAdminRouter);

const brandAdminRouter = require("./admin/brand.route");
router.use("/admin/brand", verifyAdmin, brandAdminRouter);

const categoryAdminRouter = require("./admin/category.route");
router.use("/admin/category", verifyAdmin, categoryAdminRouter);

const adminPdfRouter = require("./admin/pdf.route");
router.use("/admin/pdf", verifyAdmin, adminPdfRouter);

const adminOrderRouter = require("./admin/order.route");
router.use("/admin/orders", verifyAdmin, adminOrderRouter);

const adminPartnerRouter = require("./admin/partner.route");
router.use("/admin/partners", verifyAdmin, adminPartnerRouter);

const adminUserRouter = require("./admin/user.route");
router.use("/admin/users", verifyAdmin, adminUserRouter);

const adminLogRouter = require("./admin/log.route");
router.use("/admin/logs", verifyAdmin, adminLogRouter);

const adminDiscountRouter = require("./admin/discount.route");
router.use("/admin/discounts", verifyAdmin, adminDiscountRouter);

const adminSliderRouter = require("./admin/slider.route");
router.use("/admin/slider", verifyAdmin, adminSliderRouter);

const adminNotificationRouter = require("./admin/notification.route");
router.use("/admin/notifications", verifyAdmin, adminNotificationRouter);

router.use("/logout", logout);

module.exports = { AllRouters: router };
