const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const { ORDER_STATUS } = require('./orderService');

const PAYMENT_OUTCOME = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  TIMEOUT: 'TIMEOUT'
};

const paymentService = {
  PAYMENT_OUTCOME,

  /**
   * Process payment with idempotency protection and atomic stock updates
   * @param {Object} params
   * @param {string} params.orderId - The ID of the reserved order
   * @param {string} params.idempotencyKey - Unique key to prevent duplicate charges
   * @param {string} [params.simulateOutcome] - 'SUCCESS' | 'FAILURE' | 'TIMEOUT' (default: SUCCESS)
   * @param {string} [params.paymentMethod] - 'CASH' | 'CARD' | 'QR_PAY'
   * @param {number} [params.simulationDelayMs] - Optional simulated network delay
   */
  async processPayment({ orderId, idempotencyKey, simulateOutcome = 'SUCCESS', paymentMethod = 'CARD', simulationDelayMs = 0 }) {
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    const key = idempotencyKey || `auto-key-${orderId}`;

    // Optional delay to simulate network latency if requested
    if (simulationDelayMs > 0) {
      await new Promise(r => setTimeout(r, simulationDelayMs));
    }

    return await db.transaction(async data => {
      // 1. Idempotency Check: prevent duplicate submissions
      if (data.idempotencyKeys[key]) {
        const existingRecord = data.idempotencyKeys[key];
        const err = new Error(`Duplicate payment submission detected for idempotency key: ${key}`);
        err.statusCode = 409;
        err.code = 'DUPLICATE_PAYMENT';
        err.existingPayment = existingRecord;
        throw err;
      }

      // 2. Find order
      const order = data.orders.find(o => o.id === orderId);
      if (!order) {
        const err = new Error(`Order ${orderId} not found`);
        err.statusCode = 404;
        throw err;
      }

      // 3. Check order status
      if (order.status === ORDER_STATUS.PAID) {
        const err = new Error(`Order ${orderId} has already been paid`);
        err.statusCode = 400;
        err.code = 'ALREADY_PAID';
        throw err;
      }

      if (order.status !== ORDER_STATUS.RESERVED) {
        const err = new Error(`Cannot pay for order in status "${order.status}"`);
        err.statusCode = 400;
        throw err;
      }

      // 4. Check if reservation expired
      const now = new Date();
      if (new Date(order.expiresAt) <= now) {
        order.status = ORDER_STATUS.EXPIRED;
        order.updatedAt = now.toISOString();

        // Release reserved stock back
        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
        }

        const err = new Error('Stock reservation for this order has expired (5-minute limit exceeded)');
        err.statusCode = 410;
        err.code = 'RESERVATION_EXPIRED';
        throw err;
      }

      const outcome = (simulateOutcome || 'SUCCESS').toUpperCase();
      const paymentId = `PAY-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

      let paymentRecord = {
        id: paymentId,
        orderId: order.id,
        idempotencyKey: key,
        amount: order.totalAmount,
        paymentMethod: paymentMethod,
        outcome: outcome,
        createdAt: now.toISOString()
      };

      // 5. Handle distinct payment outcomes
      if (outcome === PAYMENT_OUTCOME.SUCCESS) {
        // Confirm Order
        order.status = ORDER_STATUS.PAID;
        order.paidAt = now.toISOString();
        order.paymentId = paymentId;
        order.updatedAt = now.toISOString();

        // Commit inventory permanently: totalStock decreases, reservedStock decreases
        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.totalStock = Math.max(0, (product.totalStock || 0) - item.quantity);
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
        }

        paymentRecord.status = 'COMPLETED';
        paymentRecord.message = 'Payment successful. Stock permanently deducted.';
      } else if (outcome === PAYMENT_OUTCOME.FAILURE) {
        // Payment failed -> release reserved stock back
        order.status = ORDER_STATUS.FAILED;
        order.failedAt = now.toISOString();
        order.failureReason = 'Payment gateway transaction declined';
        order.updatedAt = now.toISOString();

        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
        }

        paymentRecord.status = 'FAILED';
        paymentRecord.message = 'Payment failed. Reserved stock released back to inventory.';
      } else if (outcome === PAYMENT_OUTCOME.TIMEOUT) {
        // Payment timed out -> treat as reservation expired, release stock
        order.status = ORDER_STATUS.EXPIRED;
        order.failedAt = now.toISOString();
        order.failureReason = 'Payment gateway timeout';
        order.updatedAt = now.toISOString();

        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
        }

        paymentRecord.status = 'TIMEOUT';
        paymentRecord.message = 'Gateway connection timed out. Stock reservation expired.';
      } else {
        throw new Error(`Unknown outcome: ${outcome}`);
      }

      // Record idempotency key and payment
      data.idempotencyKeys[key] = paymentRecord;
      data.payments.push(paymentRecord);

      return {
        payment: paymentRecord,
        order: order
      };
    });
  },

  async getAllPayments() {
    return await db.read(data => {
      return [...data.payments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });
  }
};

module.exports = paymentService;
