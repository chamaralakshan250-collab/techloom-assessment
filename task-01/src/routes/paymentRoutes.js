const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');

// POST process payment
router.post('/process', async (req, res) => {
  try {
    const { orderId, simulateOutcome, paymentMethod, simulationDelayMs } = req.body;
    // Check for idempotency key in headers or body
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

    const result = await paymentService.processPayment({
      orderId,
      idempotencyKey,
      simulateOutcome,
      paymentMethod,
      simulationDelayMs
    });

    res.json({
      success: true,
      message: result.payment.message,
      data: result
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      error: err.message,
      code: err.code || 'PAYMENT_FAILED',
      existingPayment: err.existingPayment
    });
  }
});

// GET all payments
router.get('/', async (req, res) => {
  try {
    const payments = await paymentService.getAllPayments();
    res.json({ success: true, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
