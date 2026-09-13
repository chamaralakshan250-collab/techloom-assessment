const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');

// GET all orders
router.get('/', async (req, res) => {
  try {
    const orders = await orderService.getAllOrders();
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single order
router.get('/:id', async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST reserve stock (start checkout)
router.post('/reserve', async (req, res) => {
  try {
    const { customerName, items, notes } = req.body;
    const reservation = await orderService.createReservation({ customerName, items, notes });
    res.status(201).json({
      success: true,
      message: 'Stock successfully reserved for 5 minutes',
      data: reservation
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      error: err.message,
      code: err.code || 'RESERVATION_FAILED',
      productId: err.productId,
      available: err.available
    });
  }
});

// POST cancel order
router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    const cancelledOrder = await orderService.cancelOrder(req.params.id, reason);
    res.json({
      success: true,
      message: 'Order successfully cancelled and stock restored',
      data: cancelledOrder
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

// POST manually sweep expired reservations
router.post('/sweep-expired', async (req, res) => {
  try {
    const result = await orderService.expireStaleReservations();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
