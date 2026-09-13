const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');

const ORDER_STATUS = {
  PENDING: 'PENDING',
  RESERVED: 'RESERVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED'
};

const RESERVATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

const orderService = {
  ORDER_STATUS,
  RESERVATION_TTL_MS,

  async getAllOrders() {
    return await db.read(data => {
      // Sort newest first
      return [...data.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });
  },

  async getOrderById(id) {
    return await db.read(data => {
      return data.orders.find(o => o.id === id) || null;
    });
  },

  /**
   * Concurrency-Safe Checkout & Stock Reservation
   * Atomically verifies stock availability for all cart items,
   * reserves the requested quantities, and creates an order with a 5-minute TTL.
   */
  async createReservation({ customerName, items, notes }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Cart items cannot be empty');
    }

    return await db.transaction(async data => {
      // 1. First, check if any stale reservations need cleaning to free up stock
      const now = new Date();
      for (const order of data.orders) {
        if (order.status === ORDER_STATUS.RESERVED && new Date(order.expiresAt) <= now) {
          order.status = ORDER_STATUS.EXPIRED;
          order.updatedAt = now.toISOString();
          // Release reserved stock back
          for (const item of order.items) {
            const product = data.products.find(p => p.id === item.productId);
            if (product) {
              product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
            }
          }
        }
      }

      // 2. Validate stock availability for all items in the incoming cart
      const validatedItems = [];
      let totalAmount = 0;

      for (const item of items) {
        const product = data.products.find(p => p.id === item.productId);
        if (!product) {
          throw new Error(`Product with ID "${item.productId}" not found`);
        }

        const quantity = parseInt(item.quantity, 10);
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error(`Invalid quantity for product "${product.name}"`);
        }

        const available = product.totalStock - (product.reservedStock || 0);
        if (available < quantity) {
          const err = new Error(
            `Insufficient stock for "${product.name}". Requested: ${quantity}, Available: ${available}`
          );
          err.statusCode = 409;
          err.code = 'OUT_OF_STOCK';
          err.productId = product.id;
          err.productName = product.name;
          err.available = available;
          throw err;
        }

        const lineTotal = product.price * quantity;
        totalAmount += lineTotal;

        validatedItems.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPrice: product.price,
          quantity: quantity,
          lineTotal: parseFloat(lineTotal.toFixed(2))
        });
      }

      // 3. Atomically reserve stock for all items
      for (const item of validatedItems) {
        const product = data.products.find(p => p.id === item.productId);
        product.reservedStock = (product.reservedStock || 0) + item.quantity;
      }

      // 4. Create the reserved order record
      const orderId = `ORD-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS).toISOString();

      const newOrder = {
        id: orderId,
        customerName: customerName || 'Walk-in Customer',
        items: validatedItems,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        status: ORDER_STATUS.RESERVED,
        expiresAt: expiresAt,
        notes: notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      data.orders.push(newOrder);
      return newOrder;
    });
  },

  /**
   * Auto-expire stale reservations
   * Sweeps through all orders, flags expired ones, and releases reserved stock.
   */
  async expireStaleReservations() {
    return await db.transaction(async data => {
      const now = new Date();
      const expiredOrderIds = [];

      for (const order of data.orders) {
        if (order.status === ORDER_STATUS.RESERVED && new Date(order.expiresAt) <= now) {
          order.status = ORDER_STATUS.EXPIRED;
          order.updatedAt = now.toISOString();
          expiredOrderIds.push(order.id);

          // Release reserved stock back
          for (const item of order.items) {
            const product = data.products.find(p => p.id === item.productId);
            if (product) {
              product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
            }
          }
        }
      }

      return { expiredCount: expiredOrderIds.length, expiredOrderIds };
    });
  },

  /**
   * Cancel an order
   * - If RESERVED: releases reservedStock
   * - If PAID: restores totalStock (as items were already deducted)
   */
  async cancelOrder(orderId, reason = 'Customer cancelled') {
    return await db.transaction(async data => {
      const order = data.orders.find(o => o.id === orderId);
      if (!order) {
        const err = new Error(`Order ${orderId} not found`);
        err.statusCode = 404;
        throw err;
      }

      if (order.status === ORDER_STATUS.CANCELLED) {
        return order; // Already cancelled
      }

      if (order.status === ORDER_STATUS.EXPIRED || order.status === ORDER_STATUS.FAILED) {
        const err = new Error(`Cannot cancel order in status ${order.status}`);
        err.statusCode = 400;
        throw err;
      }

      const previousStatus = order.status;

      // Handle stock restoration based on order state
      if (previousStatus === ORDER_STATUS.RESERVED) {
        // Release reservation
        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
        }
      } else if (previousStatus === ORDER_STATUS.PAID) {
        // Restore committed stock
        for (const item of order.items) {
          const product = data.products.find(p => p.id === item.productId);
          if (product) {
            product.totalStock = (product.totalStock || 0) + item.quantity;
          }
        }
      }

      order.status = ORDER_STATUS.CANCELLED;
      order.cancellationReason = reason;
      order.updatedAt = new Date().toISOString();

      return order;
    });
  }
};

module.exports = orderService;
