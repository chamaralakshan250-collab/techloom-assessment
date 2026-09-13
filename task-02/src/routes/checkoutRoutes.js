const express = require('express');
const router = express.Router();
const checkoutService = require('../services/checkoutService');

// POST reserve stock and start checkout session
router.post('/reserve', async (req, res) => {
  try {
    const { customerEmail, customerName, shippingAddress, items } = req.body;
    const session = await checkoutService.createCheckoutSession({
      customerEmail,
      customerName,
      shippingAddress,
      items
    });

    res.status(201).json({
      success: true,
      message: 'Cart stock reserved for 5 minutes',
      data: session
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      error: err.message,
      code: err.code || 'RESERVATION_FAILED',
      productId: err.productId
    });
  }
});

module.exports = router;
