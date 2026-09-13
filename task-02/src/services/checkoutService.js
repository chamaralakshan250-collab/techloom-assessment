const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');

const ORDER_STATUS = {
  PENDING: 'PENDING',
  RESERVED: 'RESERVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED'
};

const RESERVATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

const checkoutService = {
  ORDER_STATUS,
  RESERVATION_TTL_MS,

  /**
   * Concurrency-safe Cart Checkout & Stock Reservation
   */
  async createCheckoutSession({ customerEmail, customerName, shippingAddress, items }) {
    if (!customerEmail) {
      throw new Error('Customer email is required');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Cart items cannot be empty');
    }

    return await db.transaction(async data => {
      // 1. Auto-sweep stale reservations
      const now = new Date();
      for (const order of data.orders) {
        if (order.status === ORDER_STATUS.RESERVED && new Date(order.expiresAt) <= now) {
          order.status = ORDER_STATUS.EXPIRED;
          order.updatedAt = now.toISOString();
          for (const item of order.items) {
            const product = data.products.find(p => p.id === item.productId);
            if (product) {
              product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
            }
          }
        }
      }

      // 2. Validate stock availability for each item
      const validatedItems = [];
      let subtotal = 0;

      for (const item of items) {
        const product = data.products.find(p => p.id === item.productId);
        if (!product) {
          throw new Error(`Product ID "${item.productId}" not found in store catalog`);
        }

        const quantity = parseInt(item.quantity, 10);
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error(`Invalid item quantity for "${product.name}"`);
        }

        const available = product.totalStock - (product.reservedStock || 0);
        if (available < quantity) {
          const err = new Error(`Item "${product.name}" is out of stock or insufficient. Available: ${available}, Requested: ${quantity}`);
          err.statusCode = 409;
          err.code = 'OUT_OF_STOCK';
          err.productId = product.id;
          throw err;
        }

        const lineTotal = product.price * quantity;
        subtotal += lineTotal;

        validatedItems.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          image: product.image,
          unitPrice: product.price,
          quantity: quantity,
          lineTotal: parseFloat(lineTotal.toFixed(2))
        });
      }

      // 3. Atomically lock reserved stock
      for (const item of validatedItems) {
        const product = data.products.find(p => p.id === item.productId);
        product.reservedStock = (product.reservedStock || 0) + item.quantity;
      }

      // 4. Create Order with 5-minute stock lock
      const orderId = `ORD-EC-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS).toISOString();
      const shippingCost = subtotal > 150 ? 0 : 9.99;
      const totalAmount = parseFloat((subtotal + shippingCost).toFixed(2));

      const newOrder = {
        id: orderId,
        customerEmail: customerEmail.toLowerCase().trim(),
        customerName: customerName || 'Valued Shopper',
        shippingAddress: shippingAddress || '123 Market Street, Suite 400',
        items: validatedItems,
        subtotal: parseFloat(subtotal.toFixed(2)),
        shippingCost: shippingCost,
        totalAmount: totalAmount,
        status: ORDER_STATUS.RESERVED,
        expiresAt: expiresAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      data.orders.push(newOrder);
      return newOrder;
    });
  },

  /**
   * Sweeper for background auto-expiry
   */
  async expireStaleOrders() {
    return await db.transaction(async data => {
      const now = new Date();
      let count = 0;

      for (const order of data.orders) {
        if (order.status === ORDER_STATUS.RESERVED && new Date(order.expiresAt) <= now) {
          order.status = ORDER_STATUS.EXPIRED;
          order.updatedAt = now.toISOString();
          count++;

          for (const item of order.items) {
            const product = data.products.find(p => p.id === item.productId);
            if (product) {
              product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
            }
          }
        }
      }

      return { expiredCount: count };
    });
  }
};

module.exports = checkoutService;
