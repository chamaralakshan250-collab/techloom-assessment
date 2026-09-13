const express = require('express');
const router = express.Router();
const productService = require('../services/productService');
const { seedDatabase } = require('../db/seed');

// GET all products with real-time stock level
router.get('/', async (req, res) => {
  try {
    const products = await productService.getAllProducts();
    res.json({ success: true, count: products.length, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create product
router.post('/', async (req, res) => {
  try {
    const { name, sku, price, category, totalStock, image, description } = req.body;
    if (!name || price === undefined || totalStock === undefined) {
      return res.status(400).json({ success: false, error: 'Name, price, and totalStock are required' });
    }
    const created = await productService.createProduct({ name, sku, price, category, totalStock, image, description });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const updated = await productService.updateProduct(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  try {
    const result = await productService.deleteProduct(req.params.id);
    res.json({ success: true, message: 'Product deleted', data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST reset to seed data
router.post('/admin/reset', async (req, res) => {
  try {
    await seedDatabase(true);
    const products = await productService.getAllProducts();
    res.json({ success: true, message: 'Database reset to initial sample seed products', data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
