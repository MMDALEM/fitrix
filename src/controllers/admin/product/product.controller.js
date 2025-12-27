const productModel = require("../../../models/product.model");
const { getExchangeRate } = require("../../../services/exchangeRate.service");
const controller = require("../../.controller");

class productController extends controller {
  async create(req, res, next) {
    try {
      const { title, number, category, brand, originalPrice, image, ingredients, usage, howToUse, flavor, weight, description, type } = req.body;

      const slug = this.slugify(title);

      let price = null;
      if (originalPrice)
        price = await this.convertToIRR(originalPrice);

      const product = await productModel.create({
        title,
        slug,
        image,
        category,
        brand,
        originalPrice,
        number,
        description,
        flavor,
        ingredients,
        usage,
        howToUse,
        weight,
        price,
        type,
      });

      return res.status(201).json({ success: true, product });
    } catch (err) {
      next(err);
    }
  }

  async convertToIRR(amountInAED) {
    try {
      const aedToIrr = await getExchangeRate();
      
      if (!aedToIrr) {
        throw new Error('نرخ ارز موجود نیست');
      }
      
      const priceInIRR = amountInAED * aedToIrr;
      const finalPrice = Math.ceil((priceInIRR * 1.10) / 10000) * 10000;
      
      return finalPrice;
    } catch (error) {
      console.error('خطا در تبدیل ارز:', error);
      throw new Error('خطا در تبدیل ارز');
    }
  }

}

module.exports = new productController();
