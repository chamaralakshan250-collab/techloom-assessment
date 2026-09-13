const orderService = require('./orderService');

let workerInterval = null;

function startReservationWorker(intervalMs = 10000) {
  if (workerInterval) return;

  console.log(`[ReservationWorker] Started auto-expiry background worker (Interval: ${intervalMs}ms)`);
  
  workerInterval = setInterval(async () => {
    try {
      const result = await orderService.expireStaleReservations();
      if (result.expiredCount > 0) {
        console.log(`[ReservationWorker] Auto-expired ${result.expiredCount} reservations and released stock. Orders: ${result.expiredOrderIds.join(', ')}`);
      }
    } catch (err) {
      console.error('[ReservationWorker] Error checking stale reservations:', err);
    }
  }, intervalMs);
}

function stopReservationWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[ReservationWorker] Stopped background worker');
  }
}

module.exports = { startReservationWorker, stopReservationWorker };
