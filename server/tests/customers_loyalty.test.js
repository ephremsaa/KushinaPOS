const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../index');
const db = require('../config/db');

let server;
let baseUrl;

const restA_id = 'aaaaaaaa-1111-4111-a111-111111111111';
const restB_id = 'bbbbbbbb-2222-4222-a222-222222222222';
const itemA_id = 'cccccccc-3333-4333-a333-333333333333';
const managerPin = '1234';

let tokenOwnerA;
let tokenOwnerB;

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret_key_12345', { expiresIn: '2h' });
}

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const plansRes = await db.query('SELECT id, name FROM subscription_plans');
  const proPlan = plansRes.rows.find(p => p.name === 'Pro') || plansRes.rows[0];

  // Clean test data before run to ensure reproducible state
  await db.query('DELETE FROM loyalty_transactions WHERE restaurant_id IN ($1, $2)', [restA_id, restB_id]);
  await db.query('DELETE FROM marketing_campaigns WHERE restaurant_id IN ($1, $2)', [restA_id, restB_id]);
  await db.query('DELETE FROM audit_logs WHERE restaurant_id IN ($1, $2)', [restA_id, restB_id]);
  await db.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id IN ($1, $2))', [restA_id, restB_id]);
  await db.query('DELETE FROM orders WHERE restaurant_id IN ($1, $2)', [restA_id, restB_id]);
  await db.query('DELETE FROM customers WHERE restaurant_id IN ($1, $2)', [restA_id, restB_id]);

  // Seed restaurant A (Pro plan, loyalty enabled)
  await db.query(`
    INSERT INTO restaurants (id, name, slug, email, password_hash, status, loyalty_enabled, loyalty_points_per_100_etb, loyalty_point_val_etb, loyalty_min_redeem_points, loyalty_max_bill_share_percent)
    VALUES ($1, 'CRM Test Rest A', 'crm-rest-a', 'crm_owner_a@test.com', 'hash_test', 'active', true, 10, 1.0, 50, 50)
    ON CONFLICT (id) DO UPDATE SET
      status = 'active', loyalty_enabled = true, loyalty_points_per_100_etb = 10, loyalty_point_val_etb = 1.0, loyalty_min_redeem_points = 50, loyalty_max_bill_share_percent = 50
  `, [restA_id]);

  await db.query('DELETE FROM subscriptions WHERE restaurant_id = $1', [restA_id]);
  await db.query(`
    INSERT INTO subscriptions (restaurant_id, plan_id, status, current_period_end)
    VALUES ($1, $2, 'active', NOW() + interval '30 days')
  `, [restA_id, proPlan.id]);

  // Seed restaurant B
  await db.query(`
    INSERT INTO restaurants (id, name, slug, email, password_hash, status)
    VALUES ($1, 'CRM Test Rest B', 'crm-rest-b', 'crm_owner_b@test.com', 'hash_test', 'active')
    ON CONFLICT (id) DO UPDATE SET status = 'active'
  `, [restB_id]);

  await db.query('DELETE FROM subscriptions WHERE restaurant_id = $1', [restB_id]);
  await db.query(`
    INSERT INTO subscriptions (restaurant_id, plan_id, status, current_period_end)
    VALUES ($1, $2, 'active', NOW() + interval '30 days')
  `, [restB_id, proPlan.id]);

  // Manager staff for PIN adjustments
  const pinHash = await bcrypt.hash(managerPin, 10);
  await db.query(`
    INSERT INTO staff (restaurant_id, name, email, role, pin_hash, is_active)
    VALUES ($1, 'Manager Abebe', 'manager_abebe@crmtest.com', 'manager', $2, true)
    ON CONFLICT DO NOTHING
  `, [restA_id, pinHash]);

  // Seed menu item for order tests
  await db.query(`
    INSERT INTO menu_items (id, restaurant_id, name, price, is_available)
    VALUES ($1, $2, 'Special Tibs', 300.00, true)
    ON CONFLICT (id) DO UPDATE SET price = 300.00, is_available = true
  `, [itemA_id, restA_id]);

  tokenOwnerA = makeToken({ userId: restA_id, restaurantId: restA_id, role: 'restaurant_owner' });
  tokenOwnerB = makeToken({ userId: restB_id, restaurantId: restB_id, role: 'restaurant_owner' });
});

after(async () => {
  if (server) server.close();
});

describe('👤 Customer CRM & Uniqueness', () => {
  let createdCustId;

  test('creates customer with normalized Ethiopian phone (+251...) and default consent false', async () => {
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({
        name: 'Dawit Bekele',
        phone: '0911223344', // Raw local Ethiopian phone
        notes: 'VIP customer'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.customer.name, 'Dawit Bekele');
    assert.equal(data.customer.phone, '+251911223344', 'Phone number must be normalized to +251 standard');
    assert.equal(data.customer.marketing_consent, false, 'Marketing consent must default to false');
    assert.equal(data.customer.points, 0);
    createdCustId = data.customer.id;
  });

  test('normalizes 07 Safari-com Ethiopian numbers correctly', async () => {
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({
        name: 'Sara Tesfaye',
        phone: '0712345678',
        marketing_consent: true
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.customer.phone, '+251712345678');
    assert.equal(data.customer.marketing_consent, true);
  });

  test('enforces uniqueness per restaurant by normalized phone', async () => {
    // Attempt to create duplicate phone under Restaurant A
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({
        name: 'Dawit Updated',
        phone: '+251911223344'
      })
    });

    assert.equal(res.status, 200, 'Duplicate phone should update/return existing customer');
    const data = await res.json();
    assert.equal(data.customer.id, createdCustId);
    assert.equal(data.customer.name, 'Dawit Updated');
  });

  test('same phone number can exist in a DIFFERENT restaurant (tenant isolation)', async () => {
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerB}` },
      body: JSON.stringify({
        name: 'Dawit in Rest B',
        phone: '0911223344'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.notEqual(data.customer.id, createdCustId, 'Customers across restaurants must have distinct records');
    assert.equal(data.customer.restaurant_id, restB_id);
  });
});

describe('💎 Loyalty Ledger & Points Integrity', () => {
  let custId;

  before(async () => {
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ name: 'Helen G', phone: '0922334455' })
    });
    const d = await res.json();
    custId = d.customer.id;
  });

  test('balance can never drop below 0 in strict ledger', async () => {
    const { recordLoyaltyTransaction } = require('../utils/loyaltyLedger');
    await assert.rejects(
      async () => {
        await recordLoyaltyTransaction(null, {
          restaurantId: restA_id,
          customerId: custId,
          type: 'redeem',
          points: -100 // Customer currently has 0 points
        });
      },
      /Insufficient loyalty points/,
      'Ledger transaction must reject negative resulting balance'
    );
  });

  test('earns points only when order is paid & confirmed, updates ledger and balance', async () => {
    // 1. Create order linked to customer
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({
        order_type: 'dine_in',
        customer_id: custId,
        items: [{ menu_item_id: itemA_id, quantity: 2 }] // 600 ETB
      })
    });
    assert.equal(createRes.status, 201);
    const order = await createRes.json();

    // Verify points NOT awarded while unpaid
    let custRes = await fetch(`${baseUrl}/api/customers/${custId}`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerA}` }
    });
    let custData = await custRes.json();
    assert.equal(custData.customer.points, 0, 'Unpaid order must not award points');

    // 2. Pay order via cash
    const payRes = await fetch(`${baseUrl}/api/orders/${order.id}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({
        payment_method: 'cash',
        amount_tendered: 600
      })
    });
    assert.equal(payRes.status, 200);
    const paidOrder = await payRes.json();
    assert.equal(paidOrder.payment_status, 'paid');
    assert.ok(paidOrder.points_awarded, 'Response includes awarded points');
    // 600 ETB at 10 pts per 100 ETB = 60 pts
    assert.equal(paidOrder.points_awarded.pointsEarned, 60);

    // 3. Verify ledger row and customer updated balance
    custRes = await fetch(`${baseUrl}/api/customers/${custId}`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerA}` }
    });
    custData = await custRes.json();
    assert.equal(custData.customer.points, 60);
    assert.equal(custData.loyalty_history.length, 1);
    assert.equal(custData.loyalty_history[0].type, 'earn');
    assert.equal(custData.loyalty_history[0].points, 60);
  });

  test('reverses points when order is refunded or voided', async () => {
    // Create and pay an order
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({
        order_type: 'dine_in',
        customer_id: custId,
        items: [{ menu_item_id: itemA_id, quantity: 1 }] // 300 ETB -> 30 pts
      })
    });
    const order = await createRes.json();

    await fetch(`${baseUrl}/api/orders/${order.id}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ payment_method: 'cash', amount_tendered: 300 })
    });

    // Customer had 60 + 30 = 90 pts
    let custRes = await fetch(`${baseUrl}/api/customers/${custId}`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerA}` }
    });
    let custData = await custRes.json();
    assert.equal(custData.customer.points, 90);

    // Refund order using Manager PIN
    const refundRes = await fetch(`${baseUrl}/api/orders/${order.id}/refund`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ manager_pin: managerPin, reason: 'Guest returned food' })
    });
    assert.equal(refundRes.status, 200);

    // Verify points reversed in customer balance and ledger
    custRes = await fetch(`${baseUrl}/api/customers/${custId}`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerA}` }
    });
    custData = await custRes.json();
    assert.equal(custData.customer.points, 60, 'Balance must revert by -30 points');
    const reverseTx = custData.loyalty_history.find(t => t.type === 'reverse');
    assert.ok(reverseTx, 'Ledger must record reverse transaction');
    assert.equal(reverseTx.points, -30);
  });

  test('manual points adjustments require manager PIN and reason, written to audit log', async () => {
    // Wrong PIN fails
    const failRes = await fetch(`${baseUrl}/api/customers/${custId}/adjust-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ points: 25, manager_pin: '0000', reason: 'Courtesy bonus' })
    });
    assert.equal(failRes.status, 403);

    // Missing reason fails
    const noReasonRes = await fetch(`${baseUrl}/api/customers/${custId}/adjust-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ points: 25, manager_pin: managerPin, reason: '' })
    });
    assert.equal(noReasonRes.status, 400);

    // Valid adjustment succeeds
    const okRes = await fetch(`${baseUrl}/api/customers/${custId}/adjust-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ points: 25, manager_pin: managerPin, reason: 'Birthday gift bonus' })
    });
    assert.equal(okRes.status, 200);
    const d = await okRes.json();
    assert.equal(d.new_balance, 85); // 60 + 25

    // Verify written to audit_logs
    const auditRes = await db.query(
      `SELECT * FROM audit_logs WHERE restaurant_id = $1 AND target_id = $2 AND action = 'customer_loyalty_adjust' LIMIT 1`,
      [restA_id, custId]
    );
    assert.ok(auditRes.rows[0], 'Audit log entry must be created');
  });
});

describe('📢 Marketing Consent & Opt-Out', () => {
  let custConsentedId;
  let custOptedOutId;

  before(async () => {
    const c1 = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ name: 'Opt In Customer', phone: '0933112233', marketing_consent: true })
    });
    custConsentedId = (await c1.json()).customer.id;

    const c2 = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ name: 'Opt Out Customer', phone: '0944112233', marketing_consent: false })
    });
    custOptedOutId = (await c2.json()).customer.id;
  });

  test('campaign only dispatches to customers with marketing_consent = true', async () => {
    const res = await fetch(`${baseUrl}/api/customers/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({
        title: 'Weekend Special',
        message: 'Get 15% off our Sunday buffet!',
        channel: 'whatsapp',
        segment: 'all'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    const recipientIds = data.dispatches.map(d => d.customer_id);
    assert.ok(recipientIds.includes(custConsentedId), 'Consented customer must be included');
    assert.ok(!recipientIds.includes(custOptedOutId), 'Customer without marketing consent must NOT be messaged');
  });

  test('every message automatically includes mandatory opt-out instructions', async () => {
    const { sendMessage } = require('../utils/messagingService');
    const result = await sendMessage({
      restaurantId: restA_id,
      channel: 'whatsapp',
      to: '+251933112233',
      text: 'Special promo'
    });

    assert.ok(result.fullMessage.includes('Reply STOP to opt out'), 'Opt-out clause is required on marketing messages');
    assert.ok(result.whatsappUrl.includes('STOP'), 'Opt-out must be present in external provider share URL');
  });
});

describe('🔒 Privacy & Cross-Restaurant Security', () => {
  let privacyCustId;

  before(async () => {
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ name: 'Kalkidan Privacy', phone: '0955667788', email: 'kal@example.com' })
    });
    privacyCustId = (await res.json()).customer.id;
  });

  test('anonymizes customer on request while preserving analytics', async () => {
    const res = await fetch(`${baseUrl}/api/customers/${privacyCustId}/anonymize`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenOwnerA}` }
    });

    assert.equal(res.status, 200);
    const anonRes = await db.query('SELECT * FROM customers WHERE id = $1', [privacyCustId]);
    const cust = anonRes.rows[0];
    assert.equal(cust.is_anonymized, true);
    assert.equal(cust.name, 'Anonymized Customer');
    assert.equal(cust.email, null);
    assert.equal(cust.phone, null);
  });

  test('customer data is NEVER visible across restaurants', async () => {
    const res = await fetch(`${baseUrl}/api/customers/${privacyCustId}`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerB}` } // Rest B tries to access Rest A customer
    });
    assert.equal(res.status, 404, 'Restaurant B must not be able to find Restaurant A customer');
  });
});

describe('📊 Customer & Loyalty Reports Endpoint', () => {
  test('GET /api/reports/customers-loyalty returns metrics and redemptions', async () => {
    const res = await fetch(`${baseUrl}/api/reports/customers-loyalty`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerA}` }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok('repeat_customer_rate' in data);
    assert.ok('average_spend_per_customer' in data);
    assert.ok('loyalty_points_outstanding' in data);
    assert.ok('loyalty_liability_etb' in data);
    assert.ok(Array.isArray(data.monthly_redemptions));
    assert.ok(Array.isArray(data.monthly_earned));
  });
});
