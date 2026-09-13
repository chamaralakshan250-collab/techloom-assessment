const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { seedDatabase } = require('./db/seed');
const { startReservationWorker } = require('./services/reservationWorker');

const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const stressTestRoutes = require('./routes/stressTestRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

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
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Static files (POS Frontend)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stress-test', stressTestRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'POS Order & Inventory System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Fallback for SPA routing (compatible with path-to-regexp v8 / Express 5)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexHtml = path.join(publicPath, 'index.html');
    return res.sendFile(indexHtml);
  }
  next();
});

// Initialize and start server
async function startServer() {
  try {
    await seedDatabase();
    startReservationWorker(10000); // Sweep every 10 seconds

    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Task 01 POS Server running on http://localhost:${PORT}`);
      console.log(`📡 Healthcheck: http://localhost:${PORT}/api/health`);
      console.log(`====================================================`);
    });

    return server;
  } catch (err) {
    console.error('Failed to start Task 01 server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
