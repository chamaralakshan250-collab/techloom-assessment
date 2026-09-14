const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { seedStorefront } = require('./db/seed');
const checkoutService = require('./services/checkoutService');

const storeRoutes = require('./routes/storeRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
}));
app.use(express.json());

// Built-in Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Storefront HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Static files (E-Commerce Frontend)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// API Routes
app.use('/api', storeRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'E-Commerce Storefront & Payment System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// SPA fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexHtml = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
  }
  next();
});

// Auto-expiry background worker
let workerInterval = null;
function startStorefrontWorker(intervalMs = 10000) {
  if (workerInterval) return;
  workerInterval = setInterval(async () => {
    try {
      const res = await checkoutService.expireStaleOrders();
      if (res.expiredCount > 0) {
        console.log(`[StoreWorker] Auto-expired ${res.expiredCount} checkout reservations and restored inventory.`);
      }
    } catch (err) {
      console.error('[StoreWorker] Error sweeping expired orders:', err);
    }
  }, intervalMs);
}

// Start server
async function startServer() {
  try {
    await seedStorefront();
    startStorefrontWorker(10000);

    const server = app.listen(PORT, () => {
      console.log(`========================================================`);
      console.log(`🛍️ Task 02 Storefront Server running on http://localhost:${PORT}`);
      console.log(`📡 Healthcheck: http://localhost:${PORT}/api/health`);
      console.log(`========================================================`);
    });

    return server;
  } catch (err) {
    console.error('Failed to start Task 02 server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
