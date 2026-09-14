const db = require('./db');
const initialCatalog = require('./initialCatalog');

async function seedStorefront(force = false) {
  const current = await db.read(data => data.products);
  if (!current || current.length === 0 || force) {
    console.log('[Storefront] Seeding initial product catalog...');
    await db.reset({
      products: initialCatalog,
      orders: [],
      payments: [],
      refunds: []
    });
    console.log('[Storefront] Catalog seeded with realistic products.');
  }
}

module.exports = { seedStorefront, initialCatalog };
