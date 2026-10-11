const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../index');
const db = require('../config/db');

let server;
let baseUrl;

describe('🌟 Comprehensive End-to-End Live Workflow Verification', () => {
  let adminToken;
  let restaurantId, restaurantSlug, ownerEmail, ownerPassword, ownerToken;
  let proPlanId;
  let categoryId, menuItemId;
  let waiterStaffId, waiterToken, managerPin;
  let order1Id;
  let customerId, customerPhone;
  let onlineOrderId, onlineOrderToken;
  let mobileMoneyPaymentId;
  let rawApiKey;

  before(async () => {
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Get Pro Plan ID
    const { rows: planRows } = await db.query(
      `SELECT id FROM subscription_plans WHERE LOWER(name) IN ('pro', 'enterprise') LIMIT 1`
    );
    proPlanId = planRows[0]?.id;

    // Fetch real platform admin ID from database
    const { rows: adminRows } = await db.query('SELECT id, email FROM platform_admins LIMIT 1');
    const realAdminId = adminRows[0]?.id;

    adminToken = jwt.sign(
      { userId: realAdminId, email: 'admin@kushinapos.com', role: 'platform_admin' },
      process.env.JWT_SECRET || 'test_jwt_secret_key',
      { expiresIn: '2h' }
    );
  });

  after(async () => {
    if (server) server.close();
    if (restaurantId) {
      await db.query(`DELETE FROM restaurants WHERE id = $1`, [restaurantId]).catch(() => {});
    }
  });

  it('Step 1: Register - Restaurant owner registers new account', async () => {
    const timestamp = Date.now();
    ownerEmail = `e2e_owner_${timestamp}@kushina-test.et`;
    ownerPassword = 'SecurePassword123!';
    const restName = `E2E Gourmet Addis ${timestamp}`;

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: restName,
        email: ownerEmail,
        password: ownerPassword,
        phone: '+251911998877',
        city: 'Addis Ababa',
        address: 'Bole Road, near Medhanialem'
      })
    });

    const body = await res.json();
    assert.equal(res.status, 201, `Register failed: ${JSON.stringify(body)}`);
    assert.ok(body.token);

    const decoded = jwt.decode(body.token);
    restaurantId = decoded.restaurantId || decoded.userId;
    const { rows } = await db.query('SELECT slug FROM restaurants WHERE id = $1', [restaurantId]);
    restaurantSlug = rows[0]?.slug;

    ownerToken = body.token;
    assert.ok(restaurantId);
  });

  it('Step 2: Approve - Platform Admin approves pending restaurant', async () => {
    const res = await fetch(`${baseUrl}/api/admin/restaurants/${restaurantId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });

    const body = await res.json();
    assert.equal(res.status, 200, `Approve failed: ${JSON.stringify(body)}`);
    assert.equal(body.message, 'Approved');

    const { rows } = await db.query('SELECT status FROM restaurants WHERE id = $1', [restaurantId]);
    assert.equal(rows[0]?.status, 'active');

    // Re-login to get updated token with active status
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword })
    });
    const loginBody = await loginRes.json();
    assert.equal(loginRes.status, 200, `Login failed: ${JSON.stringify(loginBody)}`);
    ownerToken = loginBody.token;
  });

  it('Step 3: Subscribe - Restaurant subscribes to Pro plan & Admin confirms', async () => {
    // 3a. Subscribe to Pro plan
    const subRes = await fetch(`${baseUrl}/api/billing/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ plan_id: proPlanId, billing_cycle: 'monthly' })
    });
    const subBody = await subRes.json();
    assert.ok([200, 201].includes(subRes.status));
    const subId = subBody.id || subBody.subscription?.id;

    // 3b. Submit Payment Proof
    const proofRes = await fetch(`${baseUrl}/api/billing/proofs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        amount: 1999.00,
        payment_method: 'telebirr',
        reference_number: `TXN_SUB_${Date.now()}`,
        proof_url: 'https://storage.supabase.com/proofs/test_receipt.jpg',
        subscription_id: subId,
        note: 'E2E Pro subscription monthly'
      })
    });
    const proofBody = await proofRes.json();
    assert.equal(proofRes.status, 201);
    const proofId = proofBody.id;

    // 3c. Platform Admin approves subscription payment
    const appRes = await fetch(`${baseUrl}/api/admin/payments/${proofId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });
    const appBody = await appRes.json();
    assert.equal(appRes.status, 200);
    assert.equal(appBody.message, 'Approved');
  });

  it('Step 4: Menu - Restaurant owner creates category and menu items', async () => {
    // Category
    const catRes = await fetch(`${baseUrl}/api/menu/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ name: 'Traditional Specialties', sort_order: 1 })
    });
    const catBody = await catRes.json();
    assert.equal(catRes.status, 201);
    categoryId = catBody.id;

    // Menu Item
    const itemRes = await fetch(`${baseUrl}/api/menu/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        category_id: categoryId,
        name: 'Special Shekla Tibs',
        price: 480.00,
        is_available: true
      })
    });
    const itemBody = await itemRes.json();
    assert.equal(itemRes.status, 201);
    menuItemId = itemBody.id;
    assert.equal(Number(itemBody.price), 480.00);
  });

  it('Step 5: Staff - Owner creates Waiter staff with PIN', async () => {
    const res = await fetch(`${baseUrl}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: 'Tigist Waiter',
        full_name: 'Tigist Alemayehu',
        email: `waiter_${Date.now()}@kushina.et`,
        role: 'waiter',
        pin: '4321'
      })
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    waiterStaffId = body.id;

    // Create staff token for Waiter
    waiterToken = jwt.sign(
      { userId: waiterStaffId, restaurantId, role: 'staff', staffRole: 'waiter', name: 'Tigist Waiter' },
      process.env.JWT_SECRET || 'test_jwt_secret_key',
      { expiresIn: '4h' }
    );
  });

  it('Step 6: Order - Waiter places dine-in order with server-calculated totals', async () => {
    customerPhone = '+251911334455';

    // Register a customer first for loyalty tracking
    const custRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: 'Dawit Bekele',
        phone: customerPhone,
        marketing_consent: true
      })
    });
    const custBody = await custRes.json();
    assert.equal(custRes.status, 201);
    customerId = custBody.id;

    // Create Dine-in order
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`
      },
      body: JSON.stringify({
        table_number: 'Table 04',
        order_type: 'dine_in',
        customer_id: customerId,
        items: [
          { menu_item_id: menuItemId, quantity: 2, notes: 'Medium spice' }
        ]
      })
    });
    const orderBody = await orderRes.json();
    assert.equal(orderRes.status, 201);
    order1Id = orderBody.id;
    assert.equal(Number(orderBody.subtotal), 960.00); // 2 * 480
    assert.equal(Number(orderBody.total), 960.00);
    assert.ok(['new', 'pending'].includes(orderBody.status));
  });

  it('Step 7: Kitchen - Kitchen station views order & transitions status (pending -> preparing -> ready)', async () => {
    // 7a. Kitchen retrieves active orders
    const kRes = await fetch(`${baseUrl}/api/kitchen/orders`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const kOrders = await kRes.json();
    assert.equal(kRes.status, 200);
    assert.ok(Array.isArray(kOrders));
    assert.ok(kOrders.some(o => o.id === order1Id));

    // 7b. Kitchen transitions to preparing
    const prepRes = await fetch(`${baseUrl}/api/kitchen/orders/${order1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ status: 'preparing' })
    });
    assert.equal(prepRes.status, 200);

    // 7c. Kitchen transitions to ready
    const readyRes = await fetch(`${baseUrl}/api/kitchen/orders/${order1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ status: 'ready' })
    });
    assert.equal(readyRes.status, 200);
  });

  it('Step 8 & 9: Pay & Bill History - Cashier settles bill and views settled history', async () => {
    // 8. Settle bill with Cash
    const payRes = await fetch(`${baseUrl}/api/orders/${order1Id}/pay`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        payment_method: 'cash',
        amount_tendered: 1000.00
      })
    });
    const payBody = await payRes.json();
    assert.equal(payRes.status, 200, `Pay failed: ${JSON.stringify(payBody)}`);
    assert.equal(payBody.payment_status, 'paid');
    assert.ok(['served', 'completed'].includes(payBody.status));

    // 9. Bill History
    const histRes = await fetch(`${baseUrl}/api/orders?status=served`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const histOrders = await histRes.json();
    assert.equal(histRes.status, 200);
    const settledOrder = histOrders.find(o => o.id === order1Id);
    assert.ok(settledOrder);
    assert.equal(settledOrder.payment_status, 'paid');
  });

  it('Step 10: Online Order - Public customer places order & tracks live', async () => {
    // Public order
    const pubOrderRes = await fetch(`${baseUrl}/api/public/online-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        order_type: 'pickup',
        customer_name: 'Almaz Ayana',
        customer_phone: '+251911554433',
        items: [{ menu_item_id: menuItemId, quantity: 1 }]
      })
    });
    const pubBody = await pubOrderRes.json();
    assert.equal(pubOrderRes.status, 201, `Online order submit failed: ${JSON.stringify(pubBody)}`);
    assert.ok(pubBody.tracking_token);
    onlineOrderToken = pubBody.tracking_token;

    // Track order via tracking token (safe payload)
    const trackRes = await fetch(`${baseUrl}/api/public/track/${onlineOrderToken}`);
    const trackBody = await trackRes.json();
    assert.equal(trackRes.status, 200);
    assert.ok(trackBody.order);
    assert.equal(trackBody.order.customer_name, 'Almaz Ayana');

    // Retrieve internal order ID for staff acceptance and payment
    const { rows: oRows } = await db.query(
      `SELECT id FROM orders WHERE tracking_token = $1`,
      [onlineOrderToken]
    );
    onlineOrderId = oRows[0]?.id;
    assert.ok(onlineOrderId);

    // Staff accepts online order
    const acceptRes = await fetch(`${baseUrl}/api/orders/${onlineOrderId}/accept-online`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ prep_time_minutes: 25 })
    });
    const acceptBody = await acceptRes.json();
    assert.equal(acceptRes.status, 200, `Accept failed: ${JSON.stringify(acceptBody)}`);
    assert.equal(acceptBody.order.accept_status, 'accepted');
  });

  it('Step 11: Loyalty Redemption - Customer earns points from order 1 and redeems on next order', async () => {
    // Check earned points on customer
    const cRes = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const cData = await cRes.json();
    assert.equal(cRes.status, 200);
    const points = cData.customer ? cData.customer.points : cData.points;
    // 960 ETB order = 96 points earned (10 ETB per 100 ETB = 96 points)
    assert.ok(points >= 90, `Expected points >= 90, got: ${points}`);

    // Create a new order redeeming 50 loyalty points
    const redeemOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        table_number: 'Table 04',
        order_type: 'dine_in',
        customer_id: customerId,
        items: [{ menu_item_id: menuItemId, quantity: 1 }], // 480 ETB
        points_to_redeem: 50
      })
    });
    const redeemBody = await redeemOrderRes.json();
    assert.equal(redeemOrderRes.status, 201, `Redeem failed: ${JSON.stringify(redeemBody)}`);
    assert.ok(redeemBody.loyalty_points_redeemed > 0);
    assert.ok(Number(redeemBody.loyalty_discount) > 0);
    assert.equal(Number(redeemBody.total), Number(redeemBody.subtotal) - Number(redeemBody.loyalty_discount));
  });

  it('Step 12: Mobile-Money Confirmation - Record reference and Manager confirmation flow', async () => {
    const txnRef = `TEL_${Date.now()}_ABC`;

    // 12a. Waiter records pending mobile money entry
    const recordRes = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`
      },
      body: JSON.stringify({
        order_id: onlineOrderId,
        method: 'telebirr',
        amount: 480.00,
        reference: txnRef,
        proof_url: 'https://storage.supabase.com/proofs/sms_screenshot.png'
      })
    });
    const recordBody = await recordRes.json();
    assert.equal(recordRes.status, 201, `Record payment failed: ${JSON.stringify(recordBody)}`);
    mobileMoneyPaymentId = recordBody.payment.id;
    assert.equal(recordBody.payment.status, 'pending');

    // 12b. Waiter cannot self-confirm (403 forbidden)
    const cashierConfRes = await fetch(`${baseUrl}/api/payments/${mobileMoneyPaymentId}/confirm`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`
      }
    });
    assert.equal(cashierConfRes.status, 403);

    // 12c. Manager/Owner confirms payment
    const mgrConfRes = await fetch(`${baseUrl}/api/payments/${mobileMoneyPaymentId}/confirm`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      }
    });
    const mgrConfBody = await mgrConfRes.json();
    assert.equal(mgrConfRes.status, 200, `Manager confirm failed: ${JSON.stringify(mgrConfBody)}`);
    assert.equal(mgrConfBody.payment?.status, 'confirmed');
  });

  it('Step 13: Partner API Call - Create API key and execute /api/v1/menu and /api/v1/orders', async () => {
    // 13a. Create API Key
    const keyRes = await fetch(`${baseUrl}/api/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: 'Partner Mobile Ordering Key',
        scopes: ['menu:read', 'orders:read', 'orders:write', 'customers:read', 'reports:read'],
        rate_limit_per_minute: 60
      })
    });
    const keyBody = await keyRes.json();
    assert.equal(keyRes.status, 201, `Create API key failed: ${JSON.stringify(keyBody)}`);
    rawApiKey = keyBody.apiKey || keyBody.raw_key;
    assert.ok(rawApiKey, 'Expected rawApiKey to be returned');
    assert.ok(rawApiKey.startsWith('kpos_live_'));

    // 13b. GET /api/v1/menu with Bearer key
    const menuApiRes = await fetch(`${baseUrl}/api/v1/menu`, {
      headers: { Authorization: `Bearer ${rawApiKey}` }
    });
    const menuApiBody = await menuApiRes.json();
    assert.equal(menuApiRes.status, 200);
    assert.ok(menuApiBody.items.some(i => i.name === 'Special Shekla Tibs'));

    // 13c. GET /api/v1/orders with Bearer key
    const ordersApiRes = await fetch(`${baseUrl}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${rawApiKey}` }
    });
    const ordersApiBody = await ordersApiRes.json();
    assert.equal(ordersApiRes.status, 200);
    assert.ok(Array.isArray(ordersApiBody.data));
    assert.ok(ordersApiBody.data.length >= 1);
  });
});
