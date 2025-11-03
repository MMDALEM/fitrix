const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    brand: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['پروتئین', 'کراتین', 'آمینو اسید', 'ویتامین', 'چربی سوز', 'گینر', 'پری ورکات', 'پست ورکات', 'سایر']
    },
    description: {
        type: String,
        required: true
    },
    ingredients: {
        type: String,
        required: true
    },
    usage: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    discountPrice: {
        type: Number,
        min: 0
    },
    images: [{
        type: String
    }],
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    weight: {
        type: String // مثل "2.2kg" یا "1000g"
    },
    servings: {
        type: Number // تعداد سروینگ
    },
    flavor: {
        type: String // طعم محصول
    },
    ratings: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0
        }
    },
    reviews: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    featured: {
        type: Boolean,
        default: false
    },
    bestseller: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual for discount percentage
ProductSchema.virtual('discountPercentage').get(function() {
    if (this.discountPrice && this.discountPrice < this.price) {
        return Math.round(((this.price - this.discountPrice) / this.price) * 100);
    }
    return 0;
});

// Virtual for current price (considering discount)
ProductSchema.virtual('currentPrice').get(function() {
    return this.discountPrice && this.discountPrice < this.price ? this.discountPrice : this.price;
});

module.exports = mongoose.model('Product', ProductSchema);