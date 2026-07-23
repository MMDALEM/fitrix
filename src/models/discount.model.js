const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    // کد تخفیف
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: 50
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    // نوع تخفیف
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'], // درصدی یا مبلغ ثابت
        default: 'percentage',
        required: true
    },
    // مقدار تخفیف (اگر percentage باشد عدد بین 1-100، اگر fixed باشد مبلغ به تومان)
    value: {
        type: Number,
        required: true,
        min: 0
    },
    // درصد تخفیف (deprecated - از value استفاده کنید)
    percent: {
        type: Number,
        min: 1,
        max: 100
    },
    // حداقل مبلغ خرید برای استفاده از کد تخفیف
    minPurchaseAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    // حداکثر مبلغ تخفیف (برای تخفیف‌های درصدی)
    maxDiscountAmount: {
        type: Number,
        default: null,
        min: 0
    },
    // محصولات مشمول تخفیف (اگر خالی باشد، روی همه محصولات اعمال میشه)
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    // دسته‌بندی‌های مشمول تخفیف
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Categories'
    }],
    // برندهای مشمول تخفیف
    brands: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand'
    }],
    // کاربران مجاز (اگر خالی باشد، همه میتونن استفاده کنن)
    allowedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // تاریخ شروع
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    // تاریخ پایان
    endDate: {
        type: Date,
        required: true
    },
    // حداکثر تعداد استفاده کل
    maxUsage: {
        type: Number,
        default: null,
        min: 1
    },
    // تعداد استفاده فعلی
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    // حداکثر تعداد استفاده هر کاربر
    maxUsagePerUser: {
        type: Number,
        default: 1,
        min: 1
    },
    // لیست استفاده‌ها
    usageHistory: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        usedAt: {
            type: Date,
            default: Date.now
        },
        discountAmount: {
            type: Number,
            required: true
        }
    }],
    // فعال/غیرفعال
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true,
});

// Index برای جستجو سریع
discountSchema.index({ code: 1, isActive: 1 });
discountSchema.index({ startDate: 1, endDate: 1 });

// متد برای چک کردن اعتبار کد تخفیف
discountSchema.methods.isValid = function(userId = null) {
    const now = new Date();
    
    // چک کردن فعال بودن
    if (!this.isActive) {
        return { valid: false, message: 'کد تخفیف غیرفعال است' };
    }
    
    // چک کردن تاریخ شروع
    if (this.startDate > now) {
        return { valid: false, message: 'کد تخفیف هنوز فعال نشده است' };
    }
    
    // چک کردن تاریخ پایان
    if (this.endDate < now) {
        return { valid: false, message: 'کد تخفیف منقضی شده است' };
    }
    
    // چک کردن تعداد استفاده کل
    if (this.maxUsage && this.usedCount >= this.maxUsage) {
        return { valid: false, message: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است' };
    }
    
    // چک کردن محدودیت کاربر خاص
    if (userId && this.allowedUsers.length > 0) {
        const isAllowed = this.allowedUsers.some(id => id.toString() === userId.toString());
        if (!isAllowed) {
            return { valid: false, message: 'شما مجاز به استفاده از این کد تخفیف نیستید' };
        }
    }
    
    // چک کردن تعداد استفاده هر کاربر
    if (userId && this.maxUsagePerUser) {
        const userUsageCount = this.usageHistory.filter(
            usage => usage.user.toString() === userId.toString()
        ).length;
        
        if (userUsageCount >= this.maxUsagePerUser) {
            return { valid: false, message: 'شما قبلاً از این کد تخفیف استفاده کرده‌اید' };
        }
    }
    
    return { valid: true, message: 'کد تخفیف معتبر است' };
};

// متد برای محاسبه مبلغ تخفیف
discountSchema.methods.calculateDiscount = function(totalAmount) {
    if (this.discountType === 'percentage') {
        let discount = (totalAmount * this.value) / 100;
        // اعمال حداکثر مبلغ تخفیف
        if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
            discount = this.maxDiscountAmount;
        }
        return Math.round(discount);
    } else {
        // تخفیف ثابت
        return Math.min(this.value, totalAmount);
    }
};

// متد برای ثبت استفاده از کد تخفیف
discountSchema.methods.recordUsage = function(userId, orderId, discountAmount) {
    this.usedCount += 1;
    this.usageHistory.push({
        user: userId,
        order: orderId,
        discountAmount: discountAmount
    });
    return this.save();
};

// Middleware برای بررسی خودکار انقضا
// سبکِ مدرنِ Mongoose (بدون next) — در نسخه‌های جدید فراخوانیِ next در هوکِ
// document باعثِ «next is not a function» می‌شود؛ این نسخه سازگار و امن است.
discountSchema.pre('save', function () {
    const now = new Date();

    // اگر تاریخ پایان گذشته باشد، غیرفعال کن
    if (this.endDate < now) {
        this.isActive = false;
    }

    // اگر تعداد استفاده به حداکثر رسیده باشد، غیرفعال کن
    if (this.maxUsage && this.usedCount >= this.maxUsage) {
        this.isActive = false;
    }

    // تبدیل code به حروف بزرگ
    if (this.code) {
        this.code = this.code.toUpperCase();
    }
});

module.exports = mongoose.model('Discount', discountSchema);