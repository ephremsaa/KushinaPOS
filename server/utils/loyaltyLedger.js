const db = require('../config/db');
const { logAudit } = require('./auditLogger');

function computeTier(points) {
  if (points >= 1000) return 'Platinum';
  if (points >= 500) return 'Gold';
  if (points >= 200) return 'Silver';
  return 'Bronze';
}

/**
 * Record a loyalty transaction and update the customer's point balance atomically.
 * Enforces: balance can never go below 0.
 */
async function recordLoyaltyTransaction(client, {
  restaurantId,
  customerId,
  orderId = null,
  type, // 'earn' | 'redeem' | 'adjust' | 'expire' | 'reverse'
  points, // positive or negative
  staffId = null,
  note = null
}) {
  const runner = client || db;

  // 1. Fetch current customer balance with row lock
  const custRes = await runner.query(
    `SELECT id, points, stamps, total_spent, order_count, name, phone 
     FROM customers 
     WHERE id = $1 AND restaurant_id = $2 
     FOR UPDATE`,
    [customerId, restaurantId]
  );

  if (!custRes.rows[0]) {
    throw new Error('Customer not found for loyalty transaction');
  }

  const customer = custRes.rows[0];
  const currentPoints = parseInt(customer.points, 10) || 0;
  const deltaPoints = parseInt(points, 10);
  const newBalance = currentPoints + deltaPoints;

  if (newBalance < 0) {
    throw new Error(`Insufficient loyalty points. Balance cannot go below 0 (Current: ${currentPoints}, Change: ${deltaPoints})`);
  }

  const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  const cleanStaffId = isUuid(staffId) ? staffId : null;

  // 2. Insert ledger row
  const txRes = await runner.query(
    `INSERT INTO loyalty_transactions 
      (restaurant_id, customer_id, order_id, type, points, balance_after, staff_id, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING *`,
    [
      restaurantId,
      customerId,
      orderId || null,
      type,
      deltaPoints,
      newBalance,
      cleanStaffId,
      note || null
    ]
  );

  // 3. Update customer points & tier
  const newTier = computeTier(newBalance);
  await runner.query(
    `UPDATE customers 
     SET points = $1, tier = $2, updated_at = NOW() 
     WHERE id = $3 AND restaurant_id = $4`,
    [newBalance, newTier, customerId, restaurantId]
  );

  return {
    transaction: txRes.rows[0],
    previousBalance: currentPoints,
    newBalance,
    tier: newTier
  };
}

/**
 * Award points when an order becomes paid and confirmed.
 * Checks restaurant settings and idempotency (prevents duplicate awards).
 */
async function awardPointsForPaidOrder(client, {
  restaurantId,
  orderId,
  customerId,
  total,
  staffId = null
}) {
  if (!customerId || !orderId) return null;
  const runner = client || db;

  // Check idempotency: did this order already earn points?
  const existingRes = await runner.query(
    `SELECT id FROM loyalty_transactions WHERE order_id = $1 AND type = 'earn' LIMIT 1`,
    [orderId]
  );
  if (existingRes.rows.length > 0) {
    return null; // Already awarded
  }

  // Fetch restaurant loyalty settings
  const restRes = await runner.query(
    `SELECT loyalty_enabled, loyalty_program_type, loyalty_points_per_100_etb 
     FROM restaurants WHERE id = $1`,
    [restaurantId]
  );
  const rest = restRes.rows[0];
  if (!rest || rest.loyalty_enabled === false) return null;

  const pointsPer100 = Number(rest.loyalty_points_per_100_etb) || 10;
  const billTotal = Number(total) || 0;
  const pointsEarned = Math.floor((billTotal / 100) * pointsPer100);

  if (pointsEarned <= 0) return null;

  const result = await recordLoyaltyTransaction(runner, {
    restaurantId,
    customerId,
    orderId,
    type: 'earn',
    points: pointsEarned,
    staffId,
    note: `Points earned from paid order`
  });

  // Update customer visit stats
  await runner.query(
    `UPDATE customers 
     SET total_spent = total_spent + $1,
         order_count = order_count + 1,
         last_visit_at = NOW(),
         updated_at = NOW() 
     WHERE id = $2 AND restaurant_id = $3`,
    [billTotal, customerId, restaurantId]
  );

  return { pointsEarned, newBalance: result.newBalance };
}

/**
 * Reverse points when an order is voided or refunded.
 */
async function reversePointsForOrder(client, {
  restaurantId,
  orderId,
  staffId = null,
  reason = 'Order cancelled / refunded'
}) {
  const runner = client || db;

  // Find any earn transactions for this order
  const earnRes = await runner.query(
    `SELECT customer_id, points FROM loyalty_transactions 
     WHERE order_id = $1 AND type = 'earn' LIMIT 1`,
    [orderId]
  );

  if (!earnRes.rows[0]) return null;
  const { customer_id: customerId, points: earnedPoints } = earnRes.rows[0];

  // Check if already reversed
  const reverseRes = await runner.query(
    `SELECT id FROM loyalty_transactions 
     WHERE order_id = $1 AND type = 'reverse' LIMIT 1`,
    [orderId]
  );
  if (reverseRes.rows.length > 0) return null;

  return await recordLoyaltyTransaction(runner, {
    restaurantId,
    customerId,
    orderId,
    type: 'reverse',
    points: -earnedPoints,
    staffId,
    note: `Reversed: ${reason}`
  });
}

module.exports = {
  computeTier,
  recordLoyaltyTransaction,
  awardPointsForPaidOrder,
  reversePointsForOrder
};
