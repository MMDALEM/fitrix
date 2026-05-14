const productModel = require("../../../models/product.model");
const { getExchangeRate } = require("../../../services/exchangeRate.service");
const controller = require("../../.controller");
const categoriesModel = require("../../../models/categories.model");
const brandModel = require("../../../models/brand.model");
const fs = require('fs');
class productController extends controller {
  async product(req, res, next) {
    try {

      const categories = await categoriesModel.find().lean()
      const brands = await brandModel.find().lean()

      return res.render('admin/product', {
        categories,
        brands,
      })
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { title, quantity, category, brand, originalPrice,ingredients, usage, howToUse, flavor, weight, description, type } = req.body;

        if (!req.file) {
            const categories = await categoriesModel.find().lean()
            const brands = await brandModel.find().lean()
            return res.render('admin/product', {
                layout: 'admin/layout',
                pageTitle: 'محصول جدید',
                currentPage: 'products',
                categories,
                brands,
                error: 'آپلود تصویر محصول الزامی است'
            })
        }

      const slug = this.slugify(title);

      const convertToIRR = await this.convertToIRR(originalPrice);

      const imageUrl = `/uploads/products/${req.file.filename}`;

      await productModel.create({
        title,
        slug,
        image: imageUrl,
        category,
        brand,
        originalPrice,
        quantity,
        description,
        flavor,
        ingredients,
        usage,
        howToUse,
        weight,
        AED : convertToIRR.AED,
        price : convertToIRR.priceTotal,
        type,
      });

      return res.redirect('/admin');
    } catch (err) {
      console.log(err)
      if(err.code == 11000) {
        fs.unlink(req.file.path, () => {})
      return this.alertAndBack(req, res, {
        title: "چنین محصولی ای از قبل وجود دارد لطفا نام محصول را تغییر دهید",
        icon: "error",
      });
      }
      if (req.file)
        fs.unlink(req.file.path, () => {})
      throw('خطا در ذخیره محصول')
    }
  }

  async convertToIRR(amountInAED) {
    const aedToIrr = await getExchangeRate();
    
    if (!aedToIrr)
      throw new Error('نرخ ارز موجود نیست');
    
    return aedToIrr;
  }
}

module.exports = new productController();
