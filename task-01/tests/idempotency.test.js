const orderService = require('../src/services/orderService');
const productService = require('../src/services/productService');
const paymentService = require('../src/services/paymentService');
const { seedDatabase } = require('../src/db/seed');

async function runIdempotencyTest() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING TASK 01 PAYMENT IDEMPOTENCY & OUTCOMES TEST');
  console.log('======================================================');

  await seedDatabase(true);

  // 1. Create a reservation
  const order = await orderService.createReservation({
    customerName: 'Idempotency Test User',
    items: [{ productId: 'prod-002', quantity: 2 }]
  });

  const idempotencyKey = `idemp-key-${Date.now()}`;
  console.log(`\n💳 1. Attempting 1st payment submission with Key: ${idempotencyKey}`);

  const payment1 = await paymentService.processPayment({
    orderId: order.id,
    idempotencyKey: idempotencyKey,
    simulateOutcome: 'SUCCESS'
  });

  console.log(`✅ 1st Payment Result: Status=${payment1.payment.status}, OrderStatus=${payment1.order.status}`);

  console.log(`\n💳 2. Attempting duplicate 2nd payment with identical Key: ${idempotencyKey}`);
  let duplicateRejected = false;
  try {
    await paymentService.processPayment({
      orderId: order.id,
      idempotencyKey: idempotencyKey,
      simulateOutcome: 'SUCCESS'
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_PAYMENT') {
      duplicateRejected = true;
      console.log(`🛡️ Successfully detected & rejected duplicate submission: "${err.message}"`);
    } else {
      console.error('Unexpected error:', err);
    }
  }

  // 3. Test Payment Failure stock restoration
  console.log('\n🧪 3. Testing Payment Failure stock restoration...');
  const failOrder = await orderService.createReservation({
    customerName: 'Failure Test User',
    items: [{ productId: 'prod-003', quantity: 3 }]
  });
  
  const productDuringFail = await productService.getProductById('prod-003');
  console.log(`🔒 During Fail Order Reservation: Reserved=${productDuringFail.reservedStock}`);

  await paymentService.processPayment({
    orderId: failOrder.id,
    idempotencyKey: `fail-key-${Date.now()}`,
    simulateOutcome: 'FAILURE'
  });

  const productAfterFail = await productService.getProductById('prod-003');
  const orderAfterFail = await orderService.getOrderById(failOrder.id);
  console.log(`🔓 After Failed Payment: OrderStatus=${orderAfterFail.status}, ProductReservedStock=${productAfterFail.reservedStock}`);

  const passed = (
    duplicateRejected &&
    payment1.order.status === 'PAID' &&
    orderAfterFail.status === 'FAILED' &&
    productAfterFail.reservedStock === 0
  );

  if (passed) {
    console.log('\n🎉 PASS: Payment idempotency, failure outcome, and stock restoration verified!');
    process.exit(0);
  } else {
    console.error('\n🚨 FAIL: Idempotency or outcome handling failed assertions.');
    process.exit(1);
  }
}

runIdempotencyTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
