const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const productService = require('../services/productService');

// POST trigger concurrency stress test
router.post('/concurrency', async (req, res) => {
  const {
    productId = 'prod-005', // By default, the limited edition item with 5 stock
    concurrentRequests = 20,
    requestedQuantityPerOrder = 1
  } = req.body;

  try {
    const targetProductBefore = await productService.getProductById(productId);
    if (!targetProductBefore) {
      return res.status(404).json({ success: false, error: 'Target test product not found' });
    }

    const availableBefore = targetProductBefore.availableStock;
    const startTime = Date.now();

    // Prepare N simultaneous promises
    const promises = [];
    for (let i = 1; i <= concurrentRequests; i++) {
      const orderPayload = {
        customerName: `Concurrent Test User #${i}`,
        items: [{ productId: productId, quantity: requestedQuantityPerOrder }],
        notes: `Automated concurrency test request ${i}`
      };

      const p = orderService.createReservation(orderPayload)
        .then(order => ({
          requestIndex: i,
          status: 'SUCCESS',
          statusCode: 201,
          orderId: order.id,
          message: 'Stock successfully reserved'
        }))
        .catch(err => ({
          requestIndex: i,
          status: 'REJECTED',
          statusCode: err.statusCode || 400,
          code: err.code || 'ERROR',
          error: err.message
        }));

      promises.push(p);
    }

    // Await all concurrent executions
    const results = await Promise.all(promises);
    const durationMs = Date.now() - startTime;

    const targetProductAfter = await productService.getProductById(productId);

    const successful = results.filter(r => r.status === 'SUCCESS');
    const rejected = results.filter(r => r.status === 'REJECTED');

    res.json({
      success: true,
      summary: {
        totalRequests: concurrentRequests,
        successfulReservations: successful.length,
        rejectedDueToStock: rejected.length,
        initialAvailableStock: availableBefore,
        finalAvailableStock: targetProductAfter.availableStock,
        finalReservedStock: targetProductAfter.reservedStock,
        finalTotalStock: targetProductAfter.totalStock,
        oversoldOccurred: targetProductAfter.reservedStock > targetProductBefore.totalStock,
        executionDurationMs: durationMs
      },
      results: results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
