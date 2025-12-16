const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const categorySchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
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
        maxlength: 1000
    },
    // نوع دسته‌بندی (اصلی، فرعی، ...)
    type: {
        type: String,
        index: true,
        required: true,
        enum: ['main', 'sub', 'child'], // اصلی، فرعی، زیرمجموعه
        default: 'main'
    },
    // دسته‌بندی والد (برای دسته‌های فرعی)
    parent: {
        type: Schema.Types.ObjectId,
        ref: "Categories",
        default: null,
        index: true
    },
    // زیردسته‌ها (برای دسته‌های اصلی و فرعی)
    subCategories: [{
        type: Schema.Types.ObjectId,
        ref: "Categories"
    }],
    // سطح دسته‌بندی در درخت (0 برای اصلی، 1 برای فرعی، ...)
    level: {
        type: Number,
        default: 0,
        min: 0,
        max: 3
    },
    // فعال/غیرفعال
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    // تصویر دسته‌بندی
    image: {
        type: String,
        default: null
    },
    // آیکون (برای نمایش در منو)
    icon: {
        type: String,
        default: null
    },
    // ترتیب نمایش
    displayOrder: {
        type: Number,
        default: 0,
        index: true
    },
    // نمایش در منوی اصلی
    showInMainMenu: {
        type: Boolean,
        default: true
    },
    // نمایش در صفحه اصلی
    showInHomePage: {
        type: Boolean,
        default: false
    },
    // تعداد محصولات (برای نمایش)
    productCount: {
        type: Number,
        default: 0,
        min: 0
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
    }]
}, {
    timestamps: true,
});

// Index برای جستجوی سریع
categorySchema.index({ slug: 1, isActive: 1 });
categorySchema.index({ type: 1, isActive: 1 });
categorySchema.index({ parent: 1, displayOrder: 1 });
categorySchema.index({ title: 'text', description: 'text' });

// Virtual برای مسیر کامل دسته‌بندی
categorySchema.virtual('path', {
    ref: 'Categories',
    localField: 'parent',
    foreignField: '_id'
});

// متد برای دریافت همه والدین
categorySchema.methods.getParents = async function() {
    const parents = [];
    let current = this;
    
    while (current.parent) {
        current = await this.constructor.findById(current.parent);
        if (current) {
            parents.unshift(current);
        } else {
            break;
        }
    }
    
    return parents;
};

// متد برای دریافت همه فرزندان
categorySchema.methods.getAllChildren = async function() {
    const children = [];
    
    const findChildren = async (categoryId) => {
        const subs = await this.constructor.find({ parent: categoryId });
        
        for (const sub of subs) {
            children.push(sub);
            await findChildren(sub._id);
        }
    };
    
    await findChildren(this._id);
    return children;
};

// متد استاتیک برای دریافت دسته‌بندی‌های اصلی
categorySchema.statics.getMainCategories = function() {
    return this.find({
        type: 'main',
        isActive: true,
        parent: null
    }).sort({ displayOrder: 1 });
};

// متد استاتیک برای دریافت درخت دسته‌بندی‌ها
categorySchema.statics.getCategoryTree = async function() {
    const categories = await this.find({ isActive: true })
        .sort({ displayOrder: 1 })
        .lean();
    
    const buildTree = (parentId = null) => {
        return categories
            .filter(cat => {
                const catParent = cat.parent ? cat.parent.toString() : null;
                const searchParent = parentId ? parentId.toString() : null;
                return catParent === searchParent;
            })
            .map(cat => ({
                ...cat,
                children: buildTree(cat._id)
            }));
    };
    
    return buildTree(null);
};

// Middleware قبل از ذخیره
categorySchema.pre('save', async function(next) {
    // تنظیم level بر اساس parent
    if (this.parent) {
        const parent = await this.constructor.findById(this.parent);
        if (parent) {
            this.level = parent.level + 1;
            
            // تعیین نوع بر اساس سطح
            if (this.level === 1) {
                this.type = 'sub';
            } else if (this.level >= 2) {
                this.type = 'child';
            }
        }
    } else {
        this.level = 0;
        this.type = 'main';
    }
    
    next();
});

// Middleware بعد از ذخیره - اضافه کردن به subCategories والد
categorySchema.post('save', async function(doc) {
    if (doc.parent) {
        const parent = await this.constructor.findById(doc.parent);
        if (parent && !parent.subCategories.includes(doc._id)) {
            parent.subCategories.push(doc._id);
            await parent.save();
        }
    }
});

// Middleware قبل از حذف - حذف از subCategories والد
categorySchema.pre('remove', async function(next) {
    if (this.parent) {
        await this.constructor.updateOne(
            { _id: this.parent },
            { $pull: { subCategories: this._id } }
        );
    }
    next();
});

module.exports = mongoose.model("Categories", categorySchema);