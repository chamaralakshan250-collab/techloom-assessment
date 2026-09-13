const db = require('../db/db');
const { ORDER_STATUS } = require('./checkoutService');

const orderHistoryService = {
  async getOrders({ email } = {}) {
    return await db.read(data => {
      let list = [...data.orders];
      if (email && email.trim()) {
        const query = email.toLowerCase().trim();
        list = list.filter(o => o.customerEmail && o.customerEmail.toLowerCase() === query);
      }
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });
  },

  async getOrderById(id) {
    return await db.read(data => {
      return data.orders.find(o => o.id === id) || null;
    });
  },

  async cancelUnpaidReservation(orderId, reason = 'Customer cancelled checkout') {
    return await db.transaction(async data => {
      const order = data.orders.find(o => o.id === orderId);
      if (!order) {
        const err = new Error(`Order ${orderId} not found`);
        err.statusCode = 404;
        throw err;
      }

      if (order.status !== ORDER_STATUS.RESERVED) {
        const err = new Error(`Cannot cancel reservation in status "${order.status}"`);
        err.statusCode = 400;
        throw err;
      }

      order.status = ORDER_STATUS.CANCELLED;
      order.cancellationReason = reason;
      order.updatedAt = new Date().toISOString();

      // Release reserved stock
      for (const item of order.items) {
        const product = data.products.find(p => p.id === item.productId);
        if (product) {
          product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
        }
      }

      return order;
    });
  }
};

module.exports = orderHistoryService;
