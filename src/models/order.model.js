const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        }
    }],
    shippingAddress: {
        fullName: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        street: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        zipCode: {
            type: String,
            required: true
        },
        country: {
            type: String,
            default: 'ایران'
        }
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['کارت بانکی', 'پرداخت در محل', 'کیف پول']
    },
    paymentResult: {
        id: String,
        status: String,
        updateTime: Date,
        emailAddress: String
    },
    itemsPrice: {
        type: Number,
        required: true
    },
    shippingPrice: {
        type: Number,
        required: true,
        default: 0
    },
    taxPrice: {
        type: Number,
        default: 0
    },
    totalPrice: {
        type: Number,
        required: true
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    paidAt: Date,
    isDelivered: {
        type: Boolean,
        default: false
    },
    deliveredAt: Date,
    status: {
        type: String,
        default: 'در انتظار پرداخت',
        enum: ['در انتظار پرداخت', 'در حال پردازش', 'ارسال شده', 'تحویل داده شده', 'لغو شده']
    },
    trackingNumber: String,
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Calculate total before saving
OrderSchema.pre('save', function(next) {
    this.itemsPrice = this.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    this.totalPrice = this.itemsPrice + this.shippingPrice + this.taxPrice;
    next();
});

module.exports = mongoose.model('Order', OrderSchema);