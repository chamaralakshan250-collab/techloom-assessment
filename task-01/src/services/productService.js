const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');

const productService = {
  async getAllProducts() {
    return await db.read(data => {
      return data.products.map(p => ({
        ...p,
        availableStock: Math.max(0, p.totalStock - (p.reservedStock || 0))
      }));
    });
  },

  async getProductById(id) {
    return await db.read(data => {
      const p = data.products.find(item => item.id === id);
      if (!p) return null;
      return {
        ...p,
        availableStock: Math.max(0, p.totalStock - (p.reservedStock || 0))
      };
    });
  },

  async createProduct({ name, sku, price, category, totalStock, image, description }) {
    return await db.transaction(async data => {
      const newProduct = {
        id: `prod-${uuidv4().substring(0, 8)}`,
        sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
        name: name.trim(),
        description: description || '',
        price: parseFloat(price) || 0,
        category: category || 'General',
        totalStock: parseInt(totalStock, 10) || 0,
        reservedStock: 0,
        image: image || 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.products.push(newProduct);
      return {
        ...newProduct,
        availableStock: newProduct.totalStock
      };
    });
  },

  async updateProduct(id, updates) {
    return await db.transaction(async data => {
      const idx = data.products.findIndex(p => p.id === id);
      if (idx === -1) {
        throw new Error('Product not found');
      }

      const product = data.products[idx];
      if (updates.name !== undefined) product.name = updates.name.trim();
      if (updates.sku !== undefined) product.sku = updates.sku.trim();
      if (updates.description !== undefined) product.description = updates.description;
      if (updates.price !== undefined) product.price = parseFloat(updates.price);
      if (updates.category !== undefined) product.category = updates.category;
      if (updates.image !== undefined) product.image = updates.image;
      if (updates.totalStock !== undefined) {
        const newTotal = parseInt(updates.totalStock, 10);
        if (newTotal < (product.reservedStock || 0)) {
          throw new Error(`Total stock cannot be less than currently reserved stock (${product.reservedStock})`);
        }
        product.totalStock = newTotal;
      }
      product.updatedAt = new Date().toISOString();

      return {
        ...product,
        availableStock: Math.max(0, product.totalStock - (product.reservedStock || 0))
      };
    });
  },

  async deleteProduct(id) {
    return await db.transaction(async data => {
      const idx = data.products.findIndex(p => p.id === id);
      if (idx === -1) {
        throw new Error('Product not found');
      }
      const product = data.products[idx];
      if ((product.reservedStock || 0) > 0) {
        throw new Error('Cannot delete product with active reservations');
      }
      data.products.splice(idx, 1);
      return { success: true, id };
    });
  }
};

module.exports = productService;
