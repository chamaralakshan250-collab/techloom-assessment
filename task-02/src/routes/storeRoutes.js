const express = require('express');
const router = express.Router();
const storeService = require('../services/storeService');
const { seedStorefront } = require('../db/seed');

// GET products with search and filtering
router.get('/products', async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, inStockOnly, sortBy } = req.query;
    const products = await storeService.getProducts({
      search,
      category,
      minPrice,
      maxPrice,
      inStockOnly,
      sortBy
    });
    res.json({ success: true, count: products.length, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single product details
router.get('/products/:id', async (req, res) => {
  try {
    const product = await storeService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await storeService.getCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset catalog seed
router.post('/store/reset', async (req, res) => {
  try {
    await seedStorefront(true);
    const products = await storeService.getProducts();
    res.json({ success: true, message: 'Storefront reset to default seed catalog', data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
