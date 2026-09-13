const express = require('express');
const router = express.Router();
const paymentGateway = require('../services/paymentGateway');

// POST process payment
router.post('/process', async (req, res) => {
  try {
    const { orderId, simulateOutcome, paymentMethod } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

    const result = await paymentGateway.processStorePayment({
      orderId,
      idempotencyKey,
      simulateOutcome,
      paymentMethod
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
      existingRecord: err.existingRecord
    });
  }
});

// POST process simulated refund
router.post('/refund', async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const result = await paymentGateway.processRefund({ orderId, reason });
    res.json({
      success: true,
      message: 'Refund processed successfully and stock restored to inventory',
      data: result
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

module.exports = router;
