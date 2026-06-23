const brandModel = require("../../models/brand.model");
const categoriesModel = require("../../models/categories.model");
const productModel = require("../../models/product.model");
const controller = require("../.controller");

class shopController extends controller {
  async shop(req, res, next) {
    try {
      const {
        page = 1,
        limit = 18,
        category,
        brand,
        search,
        minPrice,
        maxPrice,
        sort = "newest",
        inStock,
      } = req.query;

      const filter = {};

      let selectedCategory = null;
      if (category) {
        selectedCategory = await categoriesModel.findOne({ slug: category });
        if (selectedCategory) {
          filter.category = selectedCategory._id;
        }
      }

      let selectedBrand = null;
      if (brand) {
        selectedBrand = await brandModel.findOne({ slug: brand });
        if (selectedBrand) {
          filter.brand = selectedBrand._id;
        }
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      if (minPrice || maxPrice) {
        filter.priceSingle = {};
        if (minPrice) filter.priceSingle.$gte = Number(minPrice);
        if (maxPrice) filter.priceSingle.$lte = Number(maxPrice);
      }

      if (inStock === "true") {
        filter.quantity = { $gt: 0 };
      }

      let sortOption = { createdAt: -1 };
      switch (sort) {
        case "popular":
          sortOption = { viewsCount: -1 };
          break;
        case "bestselling":
          sortOption = { soldCount: -1 };
          break;
        case "cheapest":
          sortOption = { priceSingle: 1 };
          break;
        case "expensive":
          sortOption = { priceSingle: -1 };
          break;
        case "newest":
          sortOption = { createdAt: -1 };
          break;
      }

      const products = await productModel.paginate(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: sortOption,
        populate: ["category", "brand"],
      });

      const categories = await categoriesModel.find({});
      const brands = await brandModel.find({});

      const currentFilters = {
        category: category || "",
        brand: brand || "",
        search: search || "",
        minPrice: minPrice || "",
        maxPrice: maxPrice || "",
        sort: sort || "newest",
        inStock: inStock || "",
        selectedCategory,
        selectedBrand,
      };

      return res.render("shop/shop", {
        products,
        categories,
        brands,
        currentFilters,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new shopController();
