const path = require("path");
const autoBind = require("auto-bind-inheritance");
const moment = require("jalali-moment");
moment.locale("fa", { useGregorianParser: true });

module.exports = class Helpers {
    constructor(req, res) {
        autoBind(this);
        this.req = req;
        this.res = res;
    }

    getObjects() {
        return {
            auth: this.auth(),
            viewPath: this.viewPath,
            date: this.date,
            saleActive: this.saleActive,
            effPrice: this.effPrice,
            ...this.getGlobalVaribales(),
            req: this.req,
        };
    }

    auth() {
        return {
            auth: this.req.user,
        };
    }

    getGlobalVaribales() {
        return {
            errors: this.req.flash("errors"),
        };
    }

    viewPath(dir) {
        return path.resolve(path.resolve("./resource/views") + "/" + dir);
    }

    date(time) {
        return moment(time);
    }

    // آیا تخفیفِ محصول همین حالا فعال است؟
    // (تخفیف تنظیم‌شده + داخل بازه‌ی تاریخ شروع/پایان)
    saleActive(product) {
        if (!product) return false;
        if (!product.onSale || !product.salePrice || product.salePrice <= 0)
            return false;
        const now = new Date();
        if (product.saleStartDate && new Date(product.saleStartDate) > now)
            return false;
        if (product.saleEndDate && new Date(product.saleEndDate) < now)
            return false;
        return true;
    }

    // قیمت مؤثر تکی محصول با در نظر گرفتن بازه‌ی تاریخ تخفیف
    effPrice(product) {
        if (!product) return 0;
        return this.saleActive(product) ? product.salePrice : product.priceSingle;
    }
};