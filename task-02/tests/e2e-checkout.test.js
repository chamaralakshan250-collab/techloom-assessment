const storeService = require('../src/services/storeService');
const checkoutService = require('../src/services/checkoutService');
const paymentGateway = require('../src/services/paymentGateway');
const orderHistoryService = require('../src/services/orderHistoryService');
const { seedStorefront } = require('../src/db/seed');

async function runE2ETest() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING TASK 02 E-COMMERCE END-TO-END WORKFLOW TEST');
  console.log('======================================================');

  // 1. Seed store
  await seedStorefront(true);

  // 2. Test Discovery & Search
  console.log('\n🔍 1. Testing Product Discovery & Filtering...');
  const searchResults = await storeService.getProducts({ search: 'Headphones', category: 'Audio' });
  console.log(`Found ${searchResults.length} matching product(s). First: "${searchResults[0].name}"`);
  if (searchResults.length === 0) throw new Error('Search failed to return products');

  // 3. Test Stock Reservation at Checkout
  console.log('\n🛒 2. Testing Cart Stock Reservation (5-min lock)...');
  const targetProduct = searchResults[0]; // eco-prod-101 (18 total stock)
  console.log(`Product before reservation: Total=${targetProduct.totalStock}, Available=${targetProduct.availableStock}`);

  const checkoutSession = await checkoutService.createCheckoutSession({
    customerEmail: 'alex.shopper@techloom.ai',
    customerName: 'Alex Mercer',
    shippingAddress: '742 Evergreen Terrace, Springfield',
    items: [{ productId: targetProduct.id, quantity: 2 }]
  });

  console.log(`✅ Reserved Order Created: ${checkoutSession.id} (Status: ${checkoutSession.status}, Expires: ${checkoutSession.expiresAt})`);

  const productAfterReserve = await storeService.getProductById(targetProduct.id);
  console.log(`Product after reservation: Total=${productAfterReserve.totalStock}, Reserved=${productAfterReserve.reservedStock}, Available=${productAfterReserve.availableStock}`);

  if (productAfterReserve.reservedStock !== 2 || productAfterReserve.availableStock !== 16) {
    throw new Error('Stock reservation failed to lock quantities properly');
  }

  // 4. Test Payment Idempotency & Duplicate Prevention
  console.log('\n🛡️ 3. Testing Payment Idempotency & Duplicate Submission Prevention...');
  const idempotencyKey = `store-txn-${Date.now()}`;

  const payment1 = await paymentGateway.processStorePayment({
    orderId: checkoutSession.id,
    idempotencyKey: idempotencyKey,
    simulateOutcome: 'SUCCESS',
    paymentMethod: 'APPLE_PAY'
  });
  console.log(`✅ 1st Payment Captured: Txn=${payment1.payment.id}, OrderStatus=${payment1.order.status}`);

  let duplicateBlocked = false;
  try {
    await paymentGateway.processStorePayment({
      orderId: checkoutSession.id,
      idempotencyKey: idempotencyKey,
      simulateOutcome: 'SUCCESS'
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_PAYMENT') {
      duplicateBlocked = true;
      console.log(`🛡️ Blocked duplicate payment: "${err.message}"`);
    }
  }

  if (!duplicateBlocked) throw new Error('Failed to block duplicate payment submission');

  // 5. Check Inventory is permanently committed
  const productAfterPaid = await storeService.getProductById(targetProduct.id);
  console.log(`\n📦 Product after Paid: Total=${productAfterPaid.totalStock}, Reserved=${productAfterPaid.reservedStock}, Available=${productAfterPaid.availableStock}`);
  if (productAfterPaid.totalStock !== 16 || productAfterPaid.reservedStock !== 0) {
    throw new Error('Inventory was not committed accurately on payment success');
  }

  // 6. Test Order History Query
  console.log('\n📜 4. Testing Order History Retrieval...');
  const userOrders = await orderHistoryService.getOrders({ email: 'alex.shopper@techloom.ai' });
  console.log(`Found ${userOrders.length} order(s) for customer.`);
  if (userOrders.length !== 1 || userOrders[0].status !== 'PAID') {
    throw new Error('Order history retrieval mismatch');
  }

  // 7. Test Order Cancellation & Refund Simulation
  console.log('\n💸 5. Testing Order Cancellation & Simulated Refund...');
  const refundResult = await paymentGateway.processRefund({
    orderId: checkoutSession.id,
    reason: 'Customer changed mind before dispatch'
  });

  console.log(`✅ Refund Issued: RefundID=${refundResult.refund.id}, Amount=$${refundResult.refund.amount}, Status=${refundResult.order.status}`);

  // 8. Verify Stock Restoration after refund
  const productAfterRefund = await storeService.getProductById(targetProduct.id);
  console.log(`📦 Product after Refund: Total=${productAfterRefund.totalStock}, Available=${productAfterRefund.availableStock}`);
  if (productAfterRefund.totalStock !== 18 || productAfterRefund.availableStock !== 18) {
    throw new Error('Stock was not restored correctly after refund');
  }

  console.log('\n🎉 ALL TASK 02 E2E TESTS PASSED SUCCESSFULLY! (Zero flaws detected)\n');
  process.exit(0);
}

runE2ETest().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
