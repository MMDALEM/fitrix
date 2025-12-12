const addressModel = require("../../models/address.model");
const controller = require("../.controller");

class dashboradController extends controller {
  async dashborad(req, res, next) {
    try {
      const addresses = await addressModel.find({ user: req.user._id });
      return res.render("dashborad/dashborad", { addresses });
    } catch (err) {
      next(err);
    }
  }

  async address(req, res, next) {
    try {
      const addresses = await addressModel.find({ user: req.user._id });
      return res.render("dashborad/address", { addresses });
    } catch (err) {
      next(err);
    }
  }

  async addAddress(req, res, next) {
    try {
      const { title, address, postalCode, receiver, phone } = req.body;
      if (!title || !address || !postalCode || !receiver || !phone)
        return this.alertAndBack(req, res, {
          title: "لطفا تمام فیلدهای مورد نیاز را پر کنید",
          icon: "error",
        });

      await addressModel.create({
        title,
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
