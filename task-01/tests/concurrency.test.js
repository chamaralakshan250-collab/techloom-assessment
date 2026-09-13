const http = require('http');
const orderService = require('../src/services/orderService');
const productService = require('../src/services/productService');
const { seedDatabase } = require('../src/db/seed');

async function runConcurrencyTest() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING TASK 01 CONCURRENCY STRESS TEST');
  console.log('======================================================');

  // 1. Reset database to known initial state
  await seedDatabase(true);

  // Target product prod-005 has totalStock = 5
  const targetProduct = await productService.getProductById('prod-005');
  console.log(`\n📦 Target Product: "${targetProduct.name}" (ID: ${targetProduct.id})`);
  console.log(`📊 Initial Total Stock: ${targetProduct.totalStock}, Available Stock: ${targetProduct.availableStock}`);

  const CONCURRENT_USERS = 50;
  const REQUESTED_QTY_PER_USER = 1;
  console.log(`\n🚀 Firing ${CONCURRENT_USERS} simultaneous checkout reservations (1 unit each)...`);

  const startTime = Date.now();
  const promises = [];

  for (let i = 1; i <= CONCURRENT_USERS; i++) {
    const promise = orderService.createReservation({
      customerName: `Concurrent Customer #${i}`,
      items: [{ productId: targetProduct.id, quantity: REQUESTED_QTY_PER_USER }],
      notes: `Concurrency test user ${i}`
    })
      .then(order => ({
        index: i,
        status: 'SUCCESS',
        orderId: order.id
      }))
      .catch(err => ({
        index: i,
        status: 'REJECTED',
        statusCode: err.statusCode || 400,
        error: err.message
      }));

    promises.push(promise);
  }

  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;

  const successful = results.filter(r => r.status === 'SUCCESS');
  const rejected = results.filter(r => r.status === 'REJECTED');

  const finalProduct = await productService.getProductById(targetProduct.id);

  console.log('\n--- TEST RESULTS ---');
  console.log(`⏱️ Total Time: ${duration}ms`);
  console.log(`✅ Successful Reservations: ${successful.length}`);
  console.log(`❌ Rejected (Out of Stock / Conflict): ${rejected.length}`);
  console.log(`📈 Final Product State: Total=${finalProduct.totalStock}, Reserved=${finalProduct.reservedStock}, Available=${finalProduct.availableStock}`);

  // Assertions
  const passed = (
    successful.length === targetProduct.totalStock &&
    rejected.length === (CONCURRENT_USERS - targetProduct.totalStock) &&
    finalProduct.availableStock === 0 &&
    finalProduct.reservedStock === targetProduct.totalStock
  );

  if (passed) {
    console.log('\n🎉 PASS: ZERO OVERSELLING! Concurrency safety verified successfully.');
    process.exit(0);
  } else {
    console.error('\n🚨 FAIL: Concurrency anomaly detected!');
    process.exit(1);
  }
}

runConcurrencyTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
