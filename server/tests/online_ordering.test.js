const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../index');
const db = require('../config/db');

let server;
let baseUrl;

// Test IDs
const testRestId = '88888888-8888-4888-a888-888888888888';
const testItemId = '99999999-9999-4999-a999-999999999999';
const testStaffCashierId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
let testZoneId;
let tokenOwner;
let tokenCashier;

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret_key_12345', { expiresIn: '2h' });
}

before(async () => {
  // 1. Start server on ephemeral port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // 2. Fetch Growth/Pro plan for delivery feature access
  const plansRes = await db.query('SELECT id, name FROM subscription_plans');
  const proPlan = plansRes.rows.find(p => p.name === 'Pro') || plansRes.rows[0];

  // 3. Seed Restaurant with online ordering active
  await db.query(`
    INSERT INTO restaurants (
      id, name, slug, email, password_hash, status,
      online_ordering_enabled, online_pickup_enabled, online_delivery_enabled,
      online_prep_time_minutes, online_max_active_orders
    )
    VALUES ($1, 'Online Test Bistro', 'online-bistro', 'online@test.com', 'hash_test_123', 'active', true, true, true, 25, 30)
    ON CONFLICT (id) DO UPDATE SET 
      status = 'active', online_ordering_enabled = true, online_delivery_enabled = true, online_pickup_enabled = true
  `, [testRestId]);

  await db.query('DELETE FROM subscriptions WHERE restaurant_id = $1', [testRestId]);
  await db.query(`
    INSERT INTO subscriptions (restaurant_id, plan_id, status, current_period_end)
    VALUES ($1, $2, 'active', NOW() + interval '30 days')
  `, [testRestId, proPlan.id]);

  // 4. Seed Menu Item
  await db.query(`
    INSERT INTO menu_items (id, restaurant_id, name, price, is_available)
    VALUES ($1, $2, 'Doro Wat Special', 350.00, true)
    ON CONFLICT (id) DO UPDATE SET price = 350.00, is_available = true
  `, [testItemId, testRestId]);

  // 5. Seed Delivery Zone (Bole - Edna Mall)
  const zoneRes = await db.query(`
    INSERT INTO delivery_zones (restaurant_id, name, fee, min_order_amount, estimated_minutes, is_active)
    VALUES ($1, 'Bole - Edna Mall', 65.00, 200.00, 35, true)
    RETURNING id
  `, [testRestId]);
  testZoneId = zoneRes.rows[0].id;

  // 6. Seed Staff Cashier
  await db.query(`
    INSERT INTO staff (id, restaurant_id, name, email, role, is_active)
    VALUES ($1, $2, 'Abebe Cashier', 'cashier_test@online.com', 'cashier', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true
  `, [testStaffCashierId, testRestId]);

  // 7. Seed open Cash Drawer Session for the cashier
  await db.query(`
    INSERT INTO cash_drawer_sessions (restaurant_id, staff_id, starting_cash, expected_cash, status)
    VALUES ($1, $2, 500.00, 500.00, 'open')
  `, [testRestId, testStaffCashierId]);

  // Generate auth tokens
  tokenOwner = makeToken({
    userId: '77777777-7777-4777-a777-777777777777',
    email: 'online@test.com',
    role: 'restaurant_owner',
    restaurantId: testRestId
  });

  tokenCashier = makeToken({
    userId: testStaffCashierId,
    email: 'cashier@test.com',
    role: 'staff',
    staffRole: 'cashier',
    restaurantId: testRestId
  });
});

after(async () => {
  // Cleanup test data
  try {
    await db.query('DELETE FROM orders WHERE restaurant_id = $1', [testRestId]);
    await db.query('DELETE FROM delivery_zones WHERE restaurant_id = $1', [testRestId]);
    await db.query('DELETE FROM cash_drawer_sessions WHERE restaurant_id = $1', [testRestId]);
    await db.query('DELETE FROM staff WHERE id = $1', [testStaffCashierId]);
    await db.query('DELETE FROM menu_items WHERE id = $1', [testItemId]);
    await db.query('DELETE FROM subscriptions WHERE restaurant_id = $1', [testRestId]);
    await db.query('DELETE FROM restaurants WHERE id = $1', [testRestId]);
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }

  if (server) server.close();
});

describe('🛒 Online Ordering: Public Flow & Security', () => {

  test('blocks bot submissions with honeypot field', async () => {
    const res = await fetch(`${baseUrl}/api/public/online-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: testRestId,
        order_type: 'pickup',
        customer_name: 'Spam Bot',
        customer_phone: '0911223344',
        honeypot: 'http://spam-link.com',
        items: [{ menu_item_id: testItemId, quantity: 1 }]
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Bot submission rejected/i);
  });

  test('normalizes Ethiopian phone to +251, enforces DB pricing, creates unpaid order with unguessable token', async () => {
    // Client sends tampered price (5.00 instead of 350.00) and delivery fee (1.00 instead of 65.00)
    const res = await fetch(`${baseUrl}/api/public/online-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: testRestId,
        order_type: 'delivery',
        customer_name: 'Almaz Ayana',
        customer_phone: '0912345678', // local format
        delivery_zone_id: testZoneId,
        delivery_landmark: 'Near Medhanialem Church',
        items: [
          { menu_item_id: testItemId, quantity: 2, unit_price: 5.00 } // Tampered price
        ],
        delivery_fee: 1.00, // Tampered fee
        total: 11.00 // Tampered total
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.ok(body.tracking_token, 'Tracking token must be generated');
    assert.equal(body.tracking_token.length, 32, 'Must be a 32-character unguessable hex token');
    assert.equal(body.order.order_id, undefined, 'Numeric internal order ID must never be exposed');

    // Query DB to verify totals and phone normalization
    const { rows } = await db.query(
      `SELECT customer_phone, subtotal, delivery_fee, total, payment_status, accept_status, order_source 
       FROM orders WHERE tracking_token = $1`,
      [body.tracking_token]
    );

    assert.equal(rows.length, 1);
    const order = rows[0];

    // Phone normalized
    assert.equal(order.customer_phone, '+251912345678');
    // Subtotal: 2 * 350.00 = 700.00
    assert.equal(Number(order.subtotal), 700.00);
    // Delivery fee verified from delivery_zones: 65.00
    assert.equal(Number(order.delivery_fee), 65.00);
    // Total: 700 + 65 = 765.00
    assert.equal(Number(order.total), 765.00);
    // Unpaid & pending
    assert.equal(order.payment_status, 'pending');
    assert.equal(order.accept_status, 'pending');
    assert.equal(order.order_source, 'online');
  });

  test('rejects delivery order if minimum order requirement is not met', async () => {
    // Zone has min_order_amount = 200.00; create a cheaper item (100 ETB)
    const cheapItemId = '12121212-1212-4212-a212-121212121212';
    await db.query(`
      INSERT INTO menu_items (id, restaurant_id, name, price, is_available)
      VALUES ($1, $2, 'Sambusa', 100.00, true)
      ON CONFLICT (id) DO UPDATE SET price = 100.00
    `, [cheapItemId, testRestId]);

    const res = await fetch(`${baseUrl}/api/public/online-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: testRestId,
        order_type: 'delivery',
        customer_name: 'Test Customer',
        customer_phone: '0922334455',
        delivery_zone_id: testZoneId,
        delivery_landmark: 'Bole',
        items: [{ menu_item_id: cheapItemId, quantity: 1 }] // Total 100 < min 200
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Minimum order amount/i);

    await db.query('DELETE FROM menu_items WHERE id = $1', [cheapItemId]);
  });
});

describe('📍 Order Tracking: Customer Visibility', () => {

  test('allows customer to track order status by token without leaking DB ID', async () => {
    // Place order
    const placeRes = await fetch(`${baseUrl}/api/public/online-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: testRestId,
        order_type: 'delivery',
        customer_name: 'Bethlehem Tilahun',
        customer_phone: '+251911889900',
        delivery_zone_id: testZoneId,
        delivery_landmark: 'Behind Tele Medhanialem',
        items: [{ menu_item_id: testItemId, quantity: 1 }]
      })
    });
    const { tracking_token } = await placeRes.json();

    // Query tracking endpoint
    const trackRes = await fetch(`${baseUrl}/api/public/track/${tracking_token}`);
    assert.equal(trackRes.status, 200);

    const trackBody = await trackRes.json();
    assert.ok(trackBody.order);
    assert.equal(trackBody.order.customer_name, 'Bethlehem Tilahun');
    assert.equal(trackBody.order.accept_status, 'pending');
    assert.equal(trackBody.order.id, undefined, 'Must not leak database UUID');
    assert.equal(trackBody.restaurant.name, 'Online Test Bistro');
  });

  test('returns 404 for nonexistent tracking token', async () => {
    const res = await fetch(`${baseUrl}/api/public/track/nonexistent_fake_token_12345678`);
    assert.equal(res.status, 404);
  });
});

describe('👨‍🍳 Staff Management: Online Orders Inbox & COD Flow', () => {

  test('staff can accept pending order with estimated prep time', async () => {
    // 1. Create a pending online order
    const placeRes = await fetch(`${baseUrl}/api/public/online-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: testRestId,
        order_type: 'delivery',
        customer_name: 'Solomon Bogale',
        customer_phone: '0977665544',
        delivery_zone_id: testZoneId,
        delivery_landmark: 'Atlas Hotel area',
        items: [{ menu_item_id: testItemId, quantity: 1 }]
      })
    });
    const { tracking_token } = await placeRes.json();

    const { rows } = await db.query('SELECT id FROM orders WHERE tracking_token = $1', [tracking_token]);
    const orderId = rows[0].id;

    // 2. Staff accepts order with 30 min prep time
    const acceptRes = await fetch(`${baseUrl}/api/orders/${orderId}/accept-online`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ prep_time_minutes: 30 })
    });

    assert.equal(acceptRes.status, 200);
    const acceptBody = await acceptRes.json();
    assert.equal(acceptBody.order.accept_status, 'accepted');
    assert.equal(acceptBody.order.status, 'preparing');
    assert.ok(acceptBody.order.estimated_ready_at);
  });

  test('staff assigns courier, marks out for delivery, and collects COD into cashier till', async () => {
    // 1. Create order
    const placeRes = await fetch(`${baseUrl}/api/public/online-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: testRestId,
        order_type: 'delivery',
        customer_name: 'Marta Haile',
        customer_phone: '0933221100',
        delivery_zone_id: testZoneId,
        delivery_landmark: 'Bole Brass',
        items: [{ menu_item_id: testItemId, quantity: 1 }] // Total: 350 + 65 = 415 ETB
      })
    });
    const { tracking_token } = await placeRes.json();
    const { rows: initialRows } = await db.query('SELECT id, total FROM orders WHERE tracking_token = $1', [tracking_token]);
    const orderId = initialRows[0].id;
    const orderTotal = Number(initialRows[0].total);

    // 2. Accept order
    await fetch(`${baseUrl}/api/orders/${orderId}/accept-online`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwner}` },
      body: JSON.stringify({ prep_time_minutes: 20 })
    });

    // 3. Assign driver and mark out for delivery
    const assignRes = await fetch(`${baseUrl}/api/orders/${orderId}/assign-driver`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwner}` },
      body: JSON.stringify({
        driver_name: 'Dawit Courier',
        driver_phone: '+251911002233',
        mark_out_for_delivery: true
      })
    });

    assert.equal(assignRes.status, 200);
    const assignBody = await assignRes.json();
    assert.equal(assignBody.order.driver_name, 'Dawit Courier');
    assert.equal(assignBody.order.status, 'out_for_delivery');

    // 4. Mark delivered
    const delRes = await fetch(`${baseUrl}/api/orders/${orderId}/mark-delivered`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenOwner}` }
    });
    assert.equal(delRes.status, 200);

    // 5. Check cashier till before COD handover
    const tillBefore = await db.query(
      `SELECT expected_cash FROM cash_drawer_sessions WHERE restaurant_id = $1 AND staff_id = $2 AND status = 'open'`,
      [testRestId, testStaffCashierId]
    );
    const startingExpected = Number(tillBefore.rows[0].expected_cash);

    // 6. Cashier confirms COD cash handover
    const codRes = await fetch(`${baseUrl}/api/orders/${orderId}/collect-cod`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenCashier}` }
    });

    assert.equal(codRes.status, 200);
    const codBody = await codRes.json();
    assert.equal(codBody.order.payment_status, 'paid');
    assert.equal(codBody.order.payment_method, 'cash');

    // 7. Check cashier till after COD: must have increased by order total
    const tillAfter = await db.query(
      `SELECT expected_cash FROM cash_drawer_sessions WHERE restaurant_id = $1 AND staff_id = $2 AND status = 'open'`,
      [testRestId, testStaffCashierId]
    );
    const endingExpected = Number(tillAfter.rows[0].expected_cash);

    assert.equal(endingExpected, startingExpected + orderTotal, 'Cashier till must increment by COD order amount');
  });

  test('rejecting online order requires reason and updates status to cancelled', async () => {
    // 1. Create order
    const placeRes = await fetch(`${baseUrl}/api/public/online-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: testRestId,
        order_type: 'pickup',
        customer_name: 'Tewodros Kassahun',
        customer_phone: '0911554433',
        items: [{ menu_item_id: testItemId, quantity: 1 }]
      })
    });
    const { tracking_token } = await placeRes.json();
    const { rows } = await db.query('SELECT id FROM orders WHERE tracking_token = $1', [tracking_token]);
    const orderId = rows[0].id;

    // 2. Reject without reason -> fails with 400
    const failRes = await fetch(`${baseUrl}/api/orders/${orderId}/reject-online`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwner}` },
      body: JSON.stringify({ rejection_reason: '' })
    });
    assert.equal(failRes.status, 400);

    // 3. Reject with valid reason
    const rejectRes = await fetch(`${baseUrl}/api/orders/${orderId}/reject-online`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwner}` },
      body: JSON.stringify({ rejection_reason: 'Kitchen at maximum capacity for the night' })
    });

    assert.equal(rejectRes.status, 200);
    const rejectBody = await rejectRes.json();
    assert.equal(rejectBody.order.accept_status, 'rejected');
    assert.equal(rejectBody.order.status, 'cancelled');
    assert.equal(rejectBody.order.rejection_reason, 'Kitchen at maximum capacity for the night');
  });
});

describe('📊 Online Ordering Reports Endpoint', () => {

  test('aggregates online revenue, delivery fees, and rejection statistics', async () => {
    const repRes = await fetch(`${baseUrl}/api/reports/online-ordering?period=30d`, {
      headers: { 'Authorization': `Bearer ${tokenOwner}` }
    });

    assert.equal(repRes.status, 200);
    const data = await repRes.json();

    assert.ok(data.kpis);
    assert.ok(data.kpis.online_sales > 0, 'Must reflect online sales created during test');
    assert.ok(data.kpis.delivery_fees_collected > 0, 'Must calculate delivery fees');
    assert.ok(data.kpis.total_rejected >= 1, 'Must count rejected test orders');
    assert.ok(Array.isArray(data.rejection_reasons));
  });
});
