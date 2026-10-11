const pool = require('../config/db');
const { getPaymentAdapter } = require('../adapters');

/**
 * Re-checks payments stuck in initiated or pending for more than 15 minutes and expires them.
 */
async function expireStalePendingPayments(client = null) {
  const db = client || pool;
  let expiredCount = 0;
  let confirmedCount = 0;

  try {
    const { rows: stalePayments } = await db.query(
      `SELECT p.*, o.total as order_total
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       WHERE p.status IN ('initiated', 'pending')
         AND p.created_at < NOW() - INTERVAL '15 minutes'
       LIMIT 50`
    );

    for (const payment of stalePayments) {
      if (payment.provider) {
        try {
          const adapter = await getPaymentAdapter(payment.restaurant_id, payment.provider, db);
          const verifyResult = await adapter.verifyPayment(payment.reference, { amount: payment.amount });

          if (verifyResult.verified && verifyResult.status === 'paid') {
            await db.query(
              `UPDATE payments SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
              [payment.id]
            );
            confirmedCount++;
            continue;
          }
        } catch (err) {
          // If adapter failed or disabled, expire it
        }
      }

      // Expire the stuck payment
      await db.query(
        `UPDATE payments SET status = 'expired', updated_at = NOW() WHERE id = $1`,
        [payment.id]
      );
      expiredCount++;
    }

    return { totalChecked: stalePayments.length, expiredCount, confirmedCount };
  } catch (err) {
    console.error('Error in expireStalePendingPayments job:', err);
    return { error: err.message, expiredCount: 0, confirmedCount: 0 };
  }
}

let jobInterval = null;

function startPaymentExpiryJob(intervalMs = 5 * 60 * 1000) {
  if (jobInterval) return;
  jobInterval = setInterval(() => {
    expireStalePendingPayments().catch(err => console.error('Expiry job failed:', err));
  }, intervalMs);
  if (jobInterval.unref) jobInterval.unref();
}

function stopPaymentExpiryJob() {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
}

module.exports = {
  expireStalePendingPayments,
  startPaymentExpiryJob,
  stopPaymentExpiryJob,
};
