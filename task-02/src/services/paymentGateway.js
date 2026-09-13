const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const { ORDER_STATUS } = require('./checkoutService');

const PAYMENT_OUTCOME = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  TIMEOUT: 'TIMEOUT'
};

const paymentGateway = {
  PAYMENT_OUTCOME,

  /**
   * Process Storefront Payment with Idempotency Key & outcome simulation
   */
  async processStorePayment({ orderId, idempotencyKey, simulateOutcome = 'SUCCESS', paymentMethod = 'CREDIT_CARD' }) {
    if (!orderId) {
      throw new Error('Order ID is required for payment');
    }

    const key = idempotencyKey || `key-${orderId}`;

    return await db.transaction(async data => {
      // 1. Idempotency Check
      if (data.idempotencyKeys[key]) {
        const existing = data.idempotencyKeys[key];
        const err = new Error(`Duplicate payment transaction prevented. Payment for session ${key} was already recorded.`);
        err.statusCode = 409;
        err.code = 'DUPLICATE_PAYMENT';
        err.existingRecord = existing;
        throw err;
      }

      // 2. Find Order
      const order = data.orders.find(o => o.id === orderId);
      if (!order) {
        const err = new Error(`Order ${orderId} not found`);
        err.statusCode = 404;
        throw err;
      }

      if (order.status === ORDER_STATUS.PAID) {
        const err = new Error(`Order ${orderId} is already paid.`);
        err.statusCode = 400;
        throw err;
      }

      if (order.status !== ORDER_STATUS.RESERVED) {
        const err = new Error(`Cannot charge order with status "${order.status}"`);
        err.statusCode = 400;
        throw err;
      }

      // 3. Expiry check
      const now = new Date();
      if (new Date(order.expiresAt) <= now) {
        order.status = ORDER_STATUS.EXPIRED;
        order.updatedAt = now.toISOString();

        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
        }

        const err = new Error('5-minute checkout reservation expired. Please return to cart and re-order.');
        err.statusCode = 410;
        err.code = 'RESERVATION_EXPIRED';
        throw err;
      }

      const outcome = (simulateOutcome || 'SUCCESS').toUpperCase();
      const transactionId = `TXN-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

      const paymentRecord = {
        id: transactionId,
        orderId: order.id,
        idempotencyKey: key,
        amount: order.totalAmount,
        paymentMethod: paymentMethod,
        outcome: outcome,
        createdAt: now.toISOString()
      };

      // 4. Handle outcomes
      if (outcome === PAYMENT_OUTCOME.SUCCESS) {
        order.status = ORDER_STATUS.PAID;
        order.paymentId = transactionId;
        order.paidAt = now.toISOString();
        order.updatedAt = now.toISOString();

        // Commit inventory permanently
        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.totalStock = Math.max(0, (product.totalStock || 0) - item.quantity);
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
        }

        paymentRecord.status = 'COMPLETED';
        paymentRecord.message = 'Payment captured successfully.';
      } else if (outcome === PAYMENT_OUTCOME.FAILURE) {
        order.status = ORDER_STATUS.FAILED;
        order.failureReason = 'Payment declined by card issuer.';
        order.updatedAt = now.toISOString();

        // Release reserved stock back
        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
        }

        paymentRecord.status = 'FAILED';
        paymentRecord.message = 'Card declined / insufficient funds.';
      } else if (outcome === PAYMENT_OUTCOME.TIMEOUT) {
        order.status = ORDER_STATUS.EXPIRED;
        order.failureReason = 'Payment gateway timeout.';
        order.updatedAt = now.toISOString();

        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
        }

        paymentRecord.status = 'TIMEOUT';
        paymentRecord.message = 'Payment gateway did not respond in time.';
      } else {
        throw new Error(`Unsupported outcome: ${outcome}`);
      }

      data.idempotencyKeys[key] = paymentRecord;
      data.payments.push(paymentRecord);

      return {
        payment: paymentRecord,
        order: order
      };
    });
  },

  /**
   * Process and simulate refund for cancelled order
   */
  async processRefund({ orderId, reason = 'Customer requested refund' }) {
    return await db.transaction(async data => {
      const order = data.orders.find(o => o.id === orderId);
      if (!order) {
        const err = new Error(`Order ${orderId} not found`);
        err.statusCode = 404;
        throw err;
      }

      if (order.status !== ORDER_STATUS.PAID) {
        const err = new Error(`Cannot refund order in status "${order.status}". Only PAID orders can be refunded.`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      const refundId = `REF-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

      const refundRecord = {
        id: refundId,
        orderId: order.id,
        amount: order.totalAmount,
        reason: reason,
        status: 'COMPLETED',
        refundedAt: now.toISOString()
      };

      // Update order status to REFUNDED / CANCELLED
      order.status = ORDER_STATUS.REFUNDED;
      order.refundId = refundId;
      order.refundReason = reason;
      order.refundedAt = now.toISOString();
      order.updatedAt = now.toISOString();

      // Restore committed stock back to inventory
      for (const item of order.items) {
        const product = data.products.find(p => p.id === item.productId);
        if (product) {
          product.totalStock = (product.totalStock || 0) + item.quantity;
        }
      }

      data.refunds.push(refundRecord);

      return {
        refund: refundRecord,
        order: order
      };
    });
  }
};

module.exports = paymentGateway;
