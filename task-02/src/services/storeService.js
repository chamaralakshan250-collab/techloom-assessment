const db = require('../db/db');

const storeService = {
  async getProducts({ search = '', category = 'ALL', minPrice, maxPrice, inStockOnly = false, sortBy = 'featured' } = {}) {
    return await db.read(data => {
      let results = data.products.map(p => ({
        ...p,
        availableStock: Math.max(0, p.totalStock - (p.reservedStock || 0))
      }));

      // 1. Category filter
      if (category && category !== 'ALL') {
        results = results.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }

      // 2. Text Search
      if (search && search.trim()) {
        const query = search.toLowerCase().trim();
        results = results.filter(p => 
          p.name.toLowerCase().includes(query) ||
          (p.sku && p.sku.toLowerCase().includes(query)) ||
          (p.description && p.description.toLowerCase().includes(query)) ||
          (p.category && p.category.toLowerCase().includes(query))
        );
      }

      // 3. Price filtering
      if (minPrice !== undefined && !isNaN(parseFloat(minPrice))) {
        results = results.filter(p => p.price >= parseFloat(minPrice));
      }
      if (maxPrice !== undefined && !isNaN(parseFloat(maxPrice))) {
        results = results.filter(p => p.price <= parseFloat(maxPrice));
      }

      // 4. In-stock only filter
      if (inStockOnly === true || inStockOnly === 'true') {
        results = results.filter(p => p.availableStock > 0);
      }

      // 5. Sorting
      if (sortBy === 'price-low') {
        results.sort((a, b) => a.price - b.price);
      } else if (sortBy === 'price-high') {
        results.sort((a, b) => b.price - a.price);
      } else if (sortBy === 'rating') {
        results.sort((a, b) => b.rating - a.rating);
      } else if (sortBy === 'newest') {
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      return results;
    });
  },

  async getProductById(id) {
    return await db.read(data => {
      const product = data.products.find(p => p.id === id);
      if (!product) return null;
      return {
        ...product,
        availableStock: Math.max(0, product.totalStock - (product.reservedStock || 0))
      };
    });
  },

  async getCategories() {
    return await db.read(data => {
      const set = new Set(data.products.map(p => p.category));
      return Array.from(set);
    });
  }
};

module.exports = storeService;
