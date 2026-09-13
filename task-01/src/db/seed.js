const db = require('./db');

const initialProducts = [
  {
    id: 'prod-001',
    sku: 'BEV-ESPR-01',
    name: 'Double Espresso',
    description: 'Freshly extracted double shot espresso using medium-dark roast beans.',
    price: 3.50,
    category: 'Beverages',
    totalStock: 50,
    reservedStock: 0,
    image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-002',
    sku: 'BEV-MATC-02',
    name: 'Iced Matcha Latte',
    description: 'Japanese matcha green tea whisked with whole milk and light cane sugar.',
    price: 5.25,
    category: 'Beverages',
    totalStock: 30,
    reservedStock: 0,
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-003',
    sku: 'FOOD-CROIS-03',
    name: 'Butter Croissant',
    description: 'Traditional flaky French croissant baked fresh daily.',
    price: 3.75,
    category: 'Bakery',
    totalStock: 25,
    reservedStock: 0,
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-004',
    sku: 'FOOD-AVOC-04',
    name: 'Avocado Toast',
    description: 'Crushed avocado, sea salt, red pepper flakes on toasted sourdough.',
    price: 9.50,
    category: 'Food',
    totalStock: 20,
    reservedStock: 0,
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-005',
    sku: 'MERCH-FLASK-05',
    name: 'Stainless Steel Travel Tumbler (5 in Stock)',
    description: 'Double-walled insulated flask (16oz). Limited inventory item for concurrency tests.',
    price: 24.00,
    category: 'Merchandise',
    totalStock: 5,
    reservedStock: 0,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-006',
    sku: 'TECH-WIRE-06',
    name: 'Wireless Charging Pad',
    description: '10W Qi-certified wireless charging pad with USB-C cable.',
    price: 19.99,
    category: 'Electronics',
    totalStock: 15,
    reservedStock: 0,
    image: 'https://images.unsplash.com/photo-1586816879360-004f5b0c51e5?w=400&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-007',
    sku: 'FOOD-BURGER-07',
    name: 'Classic Cheeseburger',
    description: 'Beef patty, cheddar cheese, lettuce, tomato, pickles, and house sauce.',
    price: 12.50,
    category: 'Food',
    totalStock: 18,
    reservedStock: 0,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-008',
    sku: 'BEV-SMOOTH-08',
    name: 'Berry Acai Smoothie',
    description: 'Acai puree blended with strawberries, blueberries, and almond milk.',
    price: 6.50,
    category: 'Beverages',
    totalStock: 40,
    reservedStock: 0,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&q=80',
    createdAt: new Date().toISOString()
  }
];

async function seedDatabase(force = false) {
  const current = await db.read(data => data.products);
  if (!current || current.length === 0 || force) {
    console.log('Seeding initial POS product inventory...');
    await db.reset({
      products: initialProducts,
      orders: [],
      orderItems: [],
      payments: []
    });
    console.log('Database seeded with sample products.');
  }
}

module.exports = { seedDatabase, initialProducts };
