const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    // شماره سفارش (منحصر به فرد)
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    // کاربر
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // محصولات سفارش با تعداد و قیمت
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        // نام محصول (در زمان خرید - برای نمایش حتی اگر محصول حذف شد)
        productName: {
            type: String,
            required: true
        },
        // تعداد
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        // قیمت واحد در زمان خرید
        price: {
            type: Number,
            required: true,
            min: 0
        },
        // قیمت کل این آیتم
        totalPrice: {
            type: Number,
            required: true,
            min: 0
        },
        // تصویر محصول
        image: {
            type: String
        }
    }],
    // آدرس ارسال
    shippingAddress: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    },
    // جزئیات آدرس (کپی شده برای حفظ اطلاعات)
    shippingDetails: {
        receiver: String,
        phone: String,
        address: String,
        postalCode: String,
        city: String,
        state: String
    },
    // روش پرداخت
    paymentMethod: {
        type: String,
        enum: ['online', 'cash_on_delivery', 'card_on_delivery'],
        default: 'online'
    },
    paymentMethodLabel: {
        type: String,
        default: 'درگاه پرداخت آنلاین'
    },
    // مبلغ محصولات (قبل از تخفیف)
    itemsPrice: {
        type: Number,
        required: true,
        min: 0
    },
    // هزینه ارسال
    shippingPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    // مالیات
    taxPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    // کد تخفیف استفاده شده
    discountCode: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Discount',
        default: null
    },
    discountCodeString: {
        type: String,
        default: null
    },
    // مبلغ تخفیف
    discountAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    // مبلغ نهایی
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    // وضعیت پرداخت
    isPaid: {
        type: Boolean,
        default: false,
        index: true
    },
    paidAt: {
        type: Date,
        default: null
    },
    // شناسه تراکنش
    transactionId: {
        type: String,
        default: null
    },
    // وضعیت ارسال
    isDelivered: {
        type: Boolean,
        default: false,
        index: true
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    // وضعیت سفارش
    status: {
        type: String,
        default: 'pending_payment',
        enum: [
            'pending_payment',      // در انتظار پرداخت
            'payment_failed',       // پرداخت ناموفق
            'processing',           // در حال پردازش
            'shipped',              // ارسال شده
            'delivered',            // تحویل داده شده
            'cancelled',            // لغو شده
            'refunded'              // مرجوع شده
        ],
        index: true
    },
    statusLabel: {
        type: String,
        default: 'در انتظار پرداخت'
    },
    // کد رهگیری مرسوله
    trackingNumber: {
        type: String,
        default: null
    },
    // شرکت حمل و نقل
    shippingCompany: {
        type: String,
        default: null
    },
    // تاریخ ارسال
    shippedAt: {
        type: Date,
        default: null
    },
    // یادداشت‌ها
    notes: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    // یادداشت مشتری
    customerNote: {
        type: String,
        trim: true,
        maxlength: 500
    },
    // تاریخچه وضعیت‌ها
    statusHistory: [{
        status: {
            type: String,
            required: true
        },
        statusLabel: {
            type: String,
            required: true
        },
        note: String,
        changedAt: {
            type: Date,
            default: Date.now
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    // آیا مشتری درخواست کنسلی داده؟
    cancellationRequested: {
        type: Boolean,
        default: false
    },
    cancellationReason: {
        type: String,
        trim: true
    },
    cancelledAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
});

// Index برای جستجوی سریع
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

// Virtual برای محاسبه تعداد کل محصولات
OrderSchema.virtual('totalItems').get(function() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
});

// متد برای تولید شماره سفارش
OrderSchema.statics.generateOrderNumber = async function() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // یافتن آخرین سفارش امروز
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const todayOrdersCount = await this.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
    });
    
    const sequence = String(todayOrdersCount + 1).padStart(4, '0');
    return `ORD${year}${month}${day}${sequence}`;
};

// متد برای تغییر وضعیت سفارش
OrderSchema.methods.updateStatus = function(newStatus, newStatusLabel, note = '', changedBy = null) {
    this.status = newStatus;
    this.statusLabel = newStatusLabel;
    
    // اضافه کردن به تاریخچه
    this.statusHistory.push({
        status: newStatus,
        statusLabel: newStatusLabel,
        note: note,
        changedAt: new Date(),
        changedBy: changedBy
    });
    
    // آپدیت سایر فیلدها بر اساس وضعیت
    if (newStatus === 'shipped' && !this.shippedAt) {
        this.shippedAt = new Date();
    }
    
    if (newStatus === 'delivered' && !this.deliveredAt) {
        this.isDelivered = true;
        this.deliveredAt = new Date();
    }
    
    if (newStatus === 'cancelled' && !this.cancelledAt) {
        this.cancelledAt = new Date();
    }
    
    return this.save();
};

// متد برای ثبت پرداخت
OrderSchema.methods.markAsPaid = function(transactionId = null) {
    this.isPaid = true;
    this.paidAt = new Date();
    this.transactionId = transactionId;
    this.status = 'processing';
    this.statusLabel = 'در حال پردازش';
    
    this.statusHistory.push({
        status: 'processing',
        statusLabel: 'در حال پردازش',
        note: 'پرداخت با موفقیت انجام شد',
        changedAt: new Date()
    });
    
    return this.save();
};

// متد برای محاسبه مجموع قیمت
OrderSchema.methods.calculateTotal = function() {
    // محاسبه قیمت کل محصولات
    this.itemsPrice = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    
    // محاسبه قیمت نهایی
    this.totalPrice = this.itemsPrice + this.shippingPrice + this.taxPrice - this.discountAmount;
    
    // مطمئن شدن که قیمت نهایی منفی نشود
    if (this.totalPrice < 0) {
        this.totalPrice = 0;
    }
    
    return this.totalPrice;
};

// Middleware قبل از ذخیره
OrderSchema.pre('save', async function(next) {
    // اگر شماره سفارش وجود نداشت، تولید کن
    if (this.isNew && !this.orderNumber) {
        this.orderNumber = await this.constructor.generateOrderNumber();
    }
    
    // محاسبه قیمت هر آیتم
    this.items.forEach(item => {
        item.totalPrice = item.price * item.quantity;
    });
    
    // محاسبه مجموع
    this.calculateTotal();
    
    next();
});

module.exports = mongoose.model('Order', OrderSchema);