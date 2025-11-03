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
            // auth: this.auth(),
            viewPath: this.viewPath,
            date: this.date,
            // ...this.getGlobalVaribales(),
            req: this.req,
        };
    }

    viewPath(dir) {
        return path.resolve(path.resolve("./resource/views") + "/" + dir);
    }


    date(time) {
        return moment(time);
    }
};