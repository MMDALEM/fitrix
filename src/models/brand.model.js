const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const brandSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        unique: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 120,
        required: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 2000
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    // لوگوی برند
    image: {
        type: String,
        default: null
    },
    logo: {
        type: String,
        default: null
    },
    // کشور سازنده
    country: {
        type: String,
        trim: true,
        maxlength: 50
    },
    // وب‌سایت رسمی
    website: {
        type: String,
        trim: true,
        match: [/^https?:\/\/.+/, 'لطفا یک URL معتبر وارد کنید']
    },
    // نمایش در صفحه اصلی
    showInHomePage: {
        type: Boolean,
        default: false
    },
    // ترتیب نمایش
    displayOrder: {
        type: Number,
        default: 0,
        index: true
    },
    // تعداد محصولات
    productCount: {
        type: Number,
        default: 0,
        min: 0
    },
    // رنگ برند (برای نمایش در UI)
    brandColor: {
        type: String,
        match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'رنگ باید به فرمت HEX باشد']
    },
    // متا دیتا برای سئو
    metaTitle: {
        type: String,
        trim: true,
        maxlength: 100
    },
    metaDescription: {
        type: String,
        trim: true,
        maxlength: 200
    },
    metaKeywords: [{
        type: String,
        trim: true
    }],
    // شبکه‌های اجتماعی
    socialMedia: {
        instagram: {
            type: String,
            trim: true
        },
        twitter: {
            type: String,
            trim: true
        },
        facebook: {
            type: String,
            trim: true
        },
        telegram: {
            type: String,
            trim: true
        }
    },
    // امتیاز برند
    rating: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0,
            min: 0
        }
    }
}, {
    timestamps: true,
});

// Index برای جستجوی سریع
brandSchema.index({ slug: 1, isActive: 1 });
brandSchema.index({ title: 'text', description: 'text' });
brandSchema.index({ displayOrder: 1 });

// متد استاتیک برای دریافت برندهای فعال
brandSchema.statics.getActiveBrands = function() {
    return this.find({ isActive: true }).sort({ displayOrder: 1, title: 1 });
};

// متد استاتیک برای دریافت برندهای ویژه
brandSchema.statics.getFeaturedBrands = function(limit = 10) {
    return this.find({ isActive: true, isFeatured: true })
        .sort({ displayOrder: 1 })
        .limit(limit);
};

// متد استاتیک برای دریافت برندهای پرطرفدار
brandSchema.statics.getPopularBrands = function(limit = 10) {
    return this.find({ isActive: true })
        .sort({ productCount: -1, 'rating.average': -1 })
        .limit(limit);
};

// Middleware قبل از ذخیره
brandSchema.pre('save', function(next) {
    // اگر logo وجود نداشت از image استفاده کن
    if (!this.logo && this.image) {
        this.logo = this.image;
    }
    next();
});

module.exports = mongoose.model("Brand", brandSchema);