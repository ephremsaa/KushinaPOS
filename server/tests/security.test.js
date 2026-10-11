const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../index');
const db = require('../config/db');
const { computeOrderTotals } = require('../utils/orderPricing');

let server;
let baseUrl;

// Test IDs
const restA_id = '11111111-1111-4111-a111-111111111111';
const restB_id = '22222222-2222-4222-a222-222222222222';
const itemA_id = '33333333-3333-4333-a333-333333333333';
const itemB_id = '44444444-4444-4444-a444-444444444444';
const staffCashierA_id = '55555555-5555-4555-a555-555555555555';
const custA_id = '66666666-6666-4666-a666-666666666666';
const custB_id = '77777777-7777-4777-a777-777777777777';

let tokenOwnerA;
let tokenCashierA;
let tokenOwnerB;

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret_key_12345', { expiresIn: '2h' });
}

before(async () => {
  // 1. Start HTTP server on random free port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // 2. Fetch plan IDs
  const plansRes = await db.query('SELECT id, name FROM subscription_plans');
  const starterPlan = plansRes.rows.find(p => p.name === 'Starter') || plansRes.rows[0];
  const proPlan = plansRes.rows.find(p => p.name === 'Pro') || plansRes.rows[plansRes.rows.length - 1];

  // 3. Seed Restaurant A (Pro Plan -> all features: delivery, loyalty, api_access)
  await db.query(`
    INSERT INTO restaurants (id, name, slug, email, password_hash, status, tax_rate, tax_inclusive, default_delivery_fee)
    VALUES ($1, 'Test Restaurant A (Pro)', 'test-rest-a', 'owner_a@test.com', 'hash_test_123', 'active', 15, false, 45.00)
    ON CONFLICT (id) DO UPDATE SET 
      status = 'active', tax_rate = 15, tax_inclusive = false, default_delivery_fee = 45.00
  `, [restA_id]);

  await db.query('DELETE FROM subscriptions WHERE restaurant_id = $1', [restA_id]);
  await db.query(`
    INSERT INTO subscriptions (restaurant_id, plan_id, status, current_period_end)
    VALUES ($1, $2, 'active', NOW() + interval '30 days')
  `, [restA_id, proPlan.id]);

  // 4. Seed Restaurant B (Starter Plan -> locked features: no delivery, no loyalty, no api_access)
  await db.query(`
    INSERT INTO restaurants (id, name, slug, email, password_hash, status, tax_rate, tax_inclusive, default_delivery_fee)
    VALUES ($1, 'Test Restaurant B (Starter)', 'test-rest-b', 'owner_b@test.com', 'hash_test_123', 'active', 0, false, 0)
    ON CONFLICT (id) DO UPDATE SET 
      status = 'active', tax_rate = 0, tax_inclusive = false, default_delivery_fee = 0
  `, [restB_id]);

  await db.query('DELETE FROM subscriptions WHERE restaurant_id = $1', [restB_id]);
  await db.query(`
    INSERT INTO subscriptions (restaurant_id, plan_id, status, current_period_end)
    VALUES ($1, $2, 'active', NOW() + interval '30 days')
  `, [restB_id, starterPlan.id]);

  // 5. Seed Menu Items
  // Restaurant A item: 200.00 ETB
  await db.query(`
    INSERT INTO menu_items (id, restaurant_id, name, price, is_available)
    VALUES ($1, $2, 'Special Doro Wat', 200.00, true)
    ON CONFLICT (id) DO UPDATE SET price = 200.00, is_available = true
  `, [itemA_id, restA_id]);

  // Restaurant B item: 100.00 ETB
  await db.query(`
    INSERT INTO menu_items (id, restaurant_id, name, price, is_available)
    VALUES ($1, $2, 'Starter Burger', 100.00, true)
    ON CONFLICT (id) DO UPDATE SET price = 100.00, is_available = true
  `, [itemB_id, restB_id]);

  // 6. Seed Staff (Cashier for Restaurant A)
  await db.query(`
    INSERT INTO staff (id, restaurant_id, name, email, role, is_active)
    VALUES ($1, $2, 'Cashier Bob', 'cashier_bob@test.com', 'cashier', true)
    ON CONFLICT (id) DO UPDATE SET role = 'cashier', is_active = true
  `, [staffCashierA_id, restA_id]);

  // 7. Seed Customers
  await db.query(`
    INSERT INTO customers (id, restaurant_id, name, phone, points)
    VALUES ($1, $2, 'Loyal Customer A', '0911000001', 50)
    ON CONFLICT (id) DO UPDATE SET points = 50
  `, [custA_id, restA_id]);

  await db.query(`
    INSERT INTO customers (id, restaurant_id, name, phone, points)
    VALUES ($1, $2, 'Customer B', '0911000002', 20)
    ON CONFLICT (id) DO UPDATE SET points = 20
  `, [custB_id, restB_id]);

  // Create JWT Tokens
  tokenOwnerA = makeToken({
    userId: restA_id,
    email: 'owner_a@test.com',
    role: 'restaurant_owner',
    restaurantId: restA_id
  });

  tokenCashierA = makeToken({
    userId: staffCashierA_id,
    email: 'cashier_bob@test.com',
    role: 'staff',
    staffRole: 'cashier',
    restaurantId: restA_id
  });

  tokenOwnerB = makeToken({
    userId: restB_id,
    email: 'owner_b@test.com',
    role: 'restaurant_owner',
    restaurantId: restB_id
  });
});

after(async () => {
  if (server) {
    server.close();
  }
  // Clean test artifacts
  try {
    await db.query('DELETE FROM api_keys WHERE restaurant_id IN ($1, $2)', [restA_id, restB_id]);
    await db.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id IN ($1, $2))', [restA_id, restB_id]);
    await db.query('DELETE FROM orders WHERE restaurant_id IN ($1, $2)', [restA_id, restB_id]);
    await db.query('DELETE FROM audit_logs WHERE restaurant_id IN ($1, $2)', [restA_id, restB_id]);
  } catch (e) {
    // ignore cleanup errors
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRICE TAMPERING TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe('🛡️ Price Tampering Prevention', () => {
  test('ignores client-sent unit_price and total, calculates verified DB prices', async () => {
    // Client tries to order Item A (which is 200.00 ETB in DB) claiming unit_price is 1.00 ETB and total is 1.00 ETB
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({
        order_type: 'dine_in',
        items: [
          {
            menu_item_id: itemA_id,
            quantity: 2,
            unit_price: 1.00, // TAMPERED! DB price is 200.00
            total: 2.00       // TAMPERED!
          }
        ],
        subtotal: 2.00,       // TAMPERED!
        total: 2.30           // TAMPERED!
      })
    });

    assert.equal(res.status, 201, 'Order should be created successfully');
    const order = await res.json();

    // Verification:
    // Subtotal must be 2 * 200.00 = 400.00 ETB
    assert.equal(Number(order.subtotal), 400.00, 'Subtotal must derive from DB price (400.00)');
    // Tax rate for Restaurant A is 15% non-inclusive -> tax = 60.00 ETB
    assert.equal(Number(order.tax_amount), 60.00, 'Tax must be computed by server (60.00)');
    // Total must be 460.00 ETB
    assert.equal(Number(order.total), 460.00, 'Total must be strictly server-calculated (460.00)');

    // Verify stored order_items has server unit_price of 200.00
    const itemsRes = await db.query('SELECT unit_price FROM order_items WHERE order_id = $1', [order.id]);
    assert.equal(Number(itemsRes.rows[0].unit_price), 200.00, 'Stored order_items unit_price must be 200.00');
  });

  test('enforces server-defined delivery fee and plan feature on delivery orders', async () => {
    // Restaurant A has default_delivery_fee = 45.00. Client tries to send delivery_fee = 0.00
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({
        order_type: 'delivery',
        delivery_address: 'Bole Medhanialem, Addis Ababa',
        delivery_fee: 0.00, // TAMPERED!
        items: [
          {
            menu_item_id: itemA_id,
            quantity: 1
          }
        ]
      })
    });

    assert.equal(res.status, 201);
    const order = await res.json();
    assert.equal(Number(order.delivery_fee), 45.00, 'Delivery fee must be taken from server restaurant settings');
    // Subtotal 200 + Tax 30 + Delivery 45 = 275.00
    assert.equal(Number(order.total), 275.00, 'Total must include server delivery fee');
  });

  test('caps loyalty points redemption to verified database balance', async () => {
    // Customer has 50 points in DB (= 5.00 ETB discount). Client claims 50,000 points.
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({
        order_type: 'dine_in',
        customer_id: custA_id,
        points_to_redeem: 50000, // TAMPERED!
        items: [{ menu_item_id: itemA_id, quantity: 1 }]
      })
    });

    assert.equal(res.status, 201);
    const order = await res.json();
    assert.equal(order.loyalty_points_redeemed, 50, 'Points redeemed must be capped to customer database balance (50)');
    assert.equal(Number(order.loyalty_discount), 5.00, 'Loyalty discount must equal 5.00 ETB (50 pts / 10)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CROSS-RESTAURANT ACCESS TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe('🏢 Cross-Restaurant Isolation & Tenant Separation', () => {
  test('token for Restaurant B cannot read Restaurant A orders', async () => {
    // Restaurant B queries orders
    const res = await fetch(`${baseUrl}/api/orders`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerB}` }
    });
    assert.equal(res.status, 200);
    const orders = await res.json();
    
    // Assert none of the returned orders belong to Restaurant A
    const leakedOrders = orders.filter(o => o.restaurant_id === restA_id);
    assert.equal(leakedOrders.length, 0, 'Restaurant B must NEVER see Restaurant A orders');
  });

  test('token for Restaurant B cannot modify or add items to Restaurant A order', async () => {
    // First, find or create an order in Restaurant A
    const { rows } = await db.query('SELECT id FROM orders WHERE restaurant_id = $1 LIMIT 1', [restA_id]);
    assert.ok(rows[0], 'Order in Restaurant A must exist');
    const orderA_id = rows[0].id;

    // Restaurant B tries to append items to Restaurant A order
    const res = await fetch(`${baseUrl}/api/orders/${orderA_id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({
        items: [{ menu_item_id: itemB_id, quantity: 1 }]
      })
    });

    assert.equal(res.status, 404, 'Must return 404 Order not found across tenants');
  });

  test('request body cannot spoof restaurant_id to create API key for another restaurant', async () => {
    // Owner A attempts to create an API key claiming restaurant_id is Restaurant B
    const res = await fetch(`${baseUrl}/api/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({
        name: 'Spoofed Key',
        restaurant_id: restB_id // ATTEMPTED TENANT SPOOF
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.restaurant_id, restA_id, 'Key must strictly belong to authenticated restaurant (A), ignoring body');
  });

  test('Restaurant A cannot adjust loyalty points for Restaurant B customer', async () => {
    const res = await fetch(`${baseUrl}/api/loyalty/customers/${custB_id}/adjust-points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({
        points_delta: 100,
        reason: 'Unauthorized test adjustment'
      })
    });

    assert.equal(res.status, 404, 'Adjust points must return 404 for customer belonging to another restaurant');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ROLE LIMITS TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe('👮 Role Limits & Permission Boundaries', () => {
  test('cashier cannot manage or create API keys (owner only)', async () => {
    const res = await fetch(`${baseUrl}/api/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenCashierA}`
      },
      body: JSON.stringify({ name: 'Cashier Attempt Key' })
    });

    assert.equal(res.status, 403, 'Cashier must be blocked from creating API keys');
  });

  test('cashier cannot confirm mobile money payments without manager/owner role', async () => {
    // Create an unconfirmed mobile money order
    const insertRes = await db.query(`
      INSERT INTO orders (restaurant_id, status, subtotal, tax_amount, total, payment_status, payment_method, is_payment_confirmed)
      VALUES ($1, 'new', 100, 0, 100, 'pending', 'telebirr', false)
      RETURNING id
    `, [restA_id]);
    const orderId = insertRes.rows[0].id;

    const res = await fetch(`${baseUrl}/api/orders/${orderId}/confirm-payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenCashierA}`
      },
      body: JSON.stringify({ payment_reference: 'TELE-12345' })
    });

    assert.equal(res.status, 403, 'Cashier must be blocked from confirming mobile-money payment');
  });

  test('cashier cannot apply excessive discount without manager PIN', async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenCashierA}`
      },
      body: JSON.stringify({
        order_type: 'dine_in',
        discount: { type: 'percentage', value: 25 }, // > 10% limit
        items: [{ menu_item_id: itemA_id, quantity: 1 }]
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Manager PIN required/i, 'Must require manager PIN for > 10% discount');
  });

  test('unauthenticated request is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/orders`);
    assert.equal(res.status, 401, 'Unauthenticated request must return 401');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PLAN FEATURE GATING TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe('📦 Subscription Plan Feature Gating', () => {
  test('Starter plan restaurant cannot create API keys (requires api_access)', async () => {
    const res = await fetch(`${baseUrl}/api/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({ name: 'Starter Key' })
    });

    assert.equal(res.status, 403, 'Starter plan cannot use API keys');
    const data = await res.json();
    assert.equal(data.code, 'PLAN_FEATURE_LOCKED');
  });

  test('Starter plan restaurant cannot access loyalty program (requires loyalty)', async () => {
    const res = await fetch(`${baseUrl}/api/loyalty/customers`, {
      headers: { 'Authorization': `Bearer ${tokenOwnerB}` }
    });

    assert.equal(res.status, 403, 'Starter plan cannot access loyalty');
    const data = await res.json();
    assert.equal(data.code, 'PLAN_FEATURE_LOCKED');
  });

  test('Starter plan restaurant cannot place delivery orders (requires delivery)', async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({
        order_type: 'delivery',
        delivery_address: 'Kazanchis, Addis Ababa',
        items: [{ menu_item_id: itemB_id, quantity: 1 }]
      })
    });

    assert.equal(res.status, 400, 'Starter plan cannot create delivery order');
    const data = await res.json();
    assert.match(data.error, /Delivery orders are not available on the current subscription plan/i);
  });
});
