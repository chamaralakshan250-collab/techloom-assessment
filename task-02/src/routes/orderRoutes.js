const express = require('express');
const router = express.Router();
const orderHistoryService = require('../services/orderHistoryService');
const paymentGateway = require('../services/paymentGateway');
const checkoutService = require('../services/checkoutService');

// GET user order history
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    const orders = await orderHistoryService.getOrders({ email });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single order
router.get('/:id', async (req, res) => {
  try {
    const order = await orderHistoryService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST cancel / refund order
router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await orderHistoryService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.status === checkoutService.ORDER_STATUS.PAID) {
      // Automatic Refund flow for paid orders
      const result = await paymentGateway.processRefund({
        orderId: order.id,
        reason: reason || 'Customer requested order cancellation'
      });
      return res.json({
        success: true,
        message: 'Order cancelled, full refund issued, and stock restored.',
        data: result.order,
        refund: result.refund
      });
    } else if (order.status === checkoutService.ORDER_STATUS.RESERVED) {
      // Cancel reservation flow
      const cancelled = await orderHistoryService.cancelUnpaidReservation(
        order.id,
        reason || 'Customer cancelled reservation'
      );
      return res.json({
        success: true,
        message: 'Checkout reservation cancelled and stock unlocked.',
        data: cancelled
      });
    } else {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel order in status "${order.status}"`
      });
    }
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

module.exports = router;
