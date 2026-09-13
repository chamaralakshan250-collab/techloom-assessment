const db = require('../src/db/db');
const orderService = require('../src/services/orderService');
const productService = require('../src/services/productService');
const paymentService = require('../src/services/paymentService');
const { seedDatabase } = require('../src/db/seed');

async function runReservationTimeoutTest() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING TASK 01 RESERVATION & TIMEOUT TEST');
  console.log('======================================================');

  await seedDatabase(true);

  // 1. Reserve 2 units of prod-001 (initial available = 50)
  const productBefore = await productService.getProductById('prod-001');
  console.log(`📦 Product Before: Total=${productBefore.totalStock}, Reserved=${productBefore.reservedStock}, Available=${productBefore.availableStock}`);

  const order = await orderService.createReservation({
    customerName: 'Timeout Test Customer',
    items: [{ productId: 'prod-001', quantity: 2 }]
  });

  const productDuring = await productService.getProductById('prod-001');
  console.log(`🔒 During Reservation: Reserved=${productDuring.reservedStock}, Available=${productDuring.availableStock}`);

  if (productDuring.reservedStock !== 2 || productDuring.availableStock !== 48) {
    throw new Error('Reservation did not lock stock properly');
  }

  // 2. Simulate expiration by backdating order.expiresAt
  console.log('\n⏳ Simulating 5-minute timeout expiry...');
  await db.transaction(async data => {
    const o = data.orders.find(item => item.id === order.id);
    o.expiresAt = new Date(Date.now() - 10000).toISOString(); // 10s in the past
  });

  // 3. Trigger auto-expiry sweep
  const sweepResult = await orderService.expireStaleReservations();
  console.log(`🧹 Auto-expiry swept: ${sweepResult.expiredCount} order(s)`);

  const productAfter = await productService.getProductById('prod-001');
  const orderAfter = await orderService.getOrderById(order.id);

  console.log(`🔓 After Expiry: Status=${orderAfter.status}, Reserved=${productAfter.reservedStock}, Available=${productAfter.availableStock}`);

  if (orderAfter.status === orderService.ORDER_STATUS.EXPIRED && productAfter.reservedStock === 0 && productAfter.availableStock === 50) {
    console.log('\n🎉 PASS: 5-minute stock lock auto-expiry and stock release verified!');
    process.exit(0);
  } else {
    console.error('\n🚨 FAIL: Stock was not restored correctly on timeout.');
    process.exit(1);
  }
}

runReservationTimeoutTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
