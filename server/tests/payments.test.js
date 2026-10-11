const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../index');
const db = require('../config/db');
const { encryptCredentials, decryptCredentials } = require('../utils/paymentCrypto');
const { expireStalePendingPayments } = require('../jobs/paymentExpiryJob');

let server;
let baseUrl;

const restId = 'dddddddd-4444-4ddd-a444-444444444444';
const cashierStaffId = 'eeeeeeee-5555-4eee-a555-555555555555';
const managerStaffId = 'ffffffff-6666-4fff-a666-666666666666';
const managerPin = '4321';

let tokenOwner;
let tokenCashier;
let tokenManager;
let tokenAdmin;

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret_key_12345', { expiresIn: '2h' });
}

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Clean test tables
  await db.query('DELETE FROM payments WHERE restaurant_id = $1', [restId]);
  await db.query('DELETE FROM payment_webhook_logs');
  await db.query('DELETE FROM restaurant_payment_configs WHERE restaurant_id = $1', [restId]);
  await db.query('DELETE FROM audit_logs WHERE restaurant_id = $1', [restId]);
  await db.query('DELETE FROM cash_drawer_sessions WHERE restaurant_id = $1', [restId]);
  await db.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = $1)', [restId]);
  await db.query('DELETE FROM orders WHERE restaurant_id = $1', [restId]);
  await db.query('DELETE FROM staff WHERE restaurant_id = $1', [restId]);
  await db.query('DELETE FROM restaurants WHERE id = $1', [restId]);

  // Seed restaurant
  await db.query(`
    INSERT INTO restaurants (id, name, slug, email, password_hash, status, loyalty_enabled, loyalty_points_per_100_etb, loyalty_point_val_etb)
    VALUES ($1, 'Payment Test Rest', 'payment-test-rest', 'owner_pay@test.com', 'hash_test', 'active', true, 10, 1.0)
    ON CONFLICT (id) DO UPDATE SET status = 'active'
  `, [restId]);

  const hashedPin = await bcrypt.hash(managerPin, 10);

  // Seed cashier staff
  await db.query(`
    INSERT INTO staff (id, restaurant_id, name, email, role, is_active)
    VALUES ($1, $2, 'Cashier Chala', 'cashier@test.com', 'cashier', true)
  `, [cashierStaffId, restId]);

  // Seed manager staff
  await db.query(`
    INSERT INTO staff (id, restaurant_id, name, email, role, pin_hash, is_active)
    VALUES ($1, $2, 'Manager Almaz', 'manager@test.com', 'manager', $3, true)
  `, [managerStaffId, restId, hashedPin]);

  // Seed platform admin
  await db.query(`
    INSERT INTO platform_admins (id, name, email, password_hash)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Platform Admin', 'admin@kushinapos.et', 'hash_test')
    ON CONFLICT (id) DO NOTHING
  `);

  tokenOwner = makeToken({ userId: restId, role: 'restaurant_owner', restaurantId: restId, email: 'owner_pay@test.com' });
  tokenCashier = makeToken({ userId: cashierStaffId, role: 'staff', staffRole: 'cashier', restaurantId: restId, email: 'cashier@test.com' });
  tokenManager = makeToken({ userId: managerStaffId, role: 'staff', staffRole: 'manager', restaurantId: restId, email: 'manager@test.com' });
  tokenAdmin = makeToken({ userId: '00000000-0000-0000-0000-000000000001', role: 'platform_admin', email: 'admin@kushinapos.et' });
});

after(async () => {
  if (server) await server.close();
});

describe('💳 Stage 1: Payments Table & Manual Confirmation Flow', () => {
  let sampleOrderId;

  before(async () => {
    // Create a sample order to test payments against
    const { rows } = await db.query(
      `INSERT INTO orders (restaurant_id, local_id, total, subtotal, payment_status, is_payment_confirmed, status)
       VALUES ($1, 901, 500.00, 500.00, 'pending', false, 'pending')
       RETURNING id`,
      [restId]
    );
    sampleOrderId = rows[0].id;
  });

  test('Cashier records pending mobile-money payment with reference and proof photo', async () => {
    const res = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCashier}` },
      body: JSON.stringify({
        order_id: sampleOrderId,
        method: 'telebirr',
        amount: 500.00,
        reference: '  TB-12345678  ', // with whitespace to test trimming
        proof_url: '/api/private-uploads/payment-proofs/test_proof.jpg',
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.payment.status, 'pending');
    assert.strictEqual(data.payment.method, 'telebirr');
    assert.strictEqual(data.payment.reference, 'TB-12345678'); // trimmed
    assert.strictEqual(data.order_paid, false); // order remains pending until confirmed
  });

  test('Enforces reference uniqueness per restaurant (case-insensitive & trimmed)', async () => {
    const res = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCashier}` },
      body: JSON.stringify({
        order_id: sampleOrderId,
        method: 'telebirr',
        amount: 250.00,
        reference: 'tb-12345678', // lowercase attempt of same reference
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /already been used on Order #901/i);
  });

  test('Cashier cannot confirm their own payment entry (403 forbidden)', async () => {
    const payRes = await fetch(`${baseUrl}/api/payments?order_id=${sampleOrderId}`, {
      headers: { Authorization: `Bearer ${tokenCashier}` },
    });
    const payments = await payRes.json();
    const pendingPayment = payments.find(p => p.status === 'pending');
    assert.ok(pendingPayment);

    const confRes = await fetch(`${baseUrl}/api/payments/${pendingPayment.id}/confirm`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenCashier}` },
    });

    assert.strictEqual(confRes.status, 403);
    const err = await confRes.json();
    assert.match(err.error, /Cashiers cannot confirm their own payment entries/i);
  });

  test('Manager confirms payment: marks confirmed, updates order paid, and writes audit log', async () => {
    const payRes = await fetch(`${baseUrl}/api/payments?order_id=${sampleOrderId}`, {
      headers: { Authorization: `Bearer ${tokenManager}` },
    });
    const payments = await payRes.json();
    const pendingPayment = payments.find(p => p.status === 'pending');

    const confRes = await fetch(`${baseUrl}/api/payments/${pendingPayment.id}/confirm`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenManager}` },
    });

    assert.strictEqual(confRes.status, 200);
    const data = await confRes.json();
    assert.strictEqual(data.payment.status, 'confirmed');
    assert.strictEqual(data.order_paid, true);

    // Verify order is paid
    const { rows: oRows } = await db.query('SELECT payment_status, is_payment_confirmed FROM orders WHERE id = $1', [sampleOrderId]);
    assert.strictEqual(oRows[0].payment_status, 'paid');
    assert.strictEqual(oRows[0].is_payment_confirmed, true);

    // Verify audit log
    const { rows: auditRows } = await db.query(
      `SELECT * FROM audit_logs WHERE restaurant_id = $1 AND action = 'payment_confirmed' ORDER BY created_at DESC LIMIT 1`,
      [restId]
    );
    assert.ok(auditRows.length > 0);
    assert.strictEqual(auditRows[0].target_id, pendingPayment.id);
  });

  test('Split bill payment: order is marked paid only when confirmed payments cover total', async () => {
    const { rows } = await db.query(
      `INSERT INTO orders (restaurant_id, local_id, total, subtotal, payment_status, status)
       VALUES ($1, 902, 600.00, 600.00, 'pending', 'pending') RETURNING id`,
      [restId]
    );
    const splitOrderId = rows[0].id;

    // Payment 1: Cash 200 ETB (auto-confirmed)
    const p1 = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCashier}` },
      body: JSON.stringify({ order_id: splitOrderId, method: 'cash', amount: 200 }),
    });
    const d1 = await p1.json();
    assert.strictEqual(d1.payment.status, 'confirmed');
    assert.strictEqual(d1.order_paid, false); // 200 of 600 -> not paid yet

    // Payment 2: Telebirr 400 ETB (pending)
    const p2 = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCashier}` },
      body: JSON.stringify({ order_id: splitOrderId, method: 'telebirr', amount: 400, reference: 'TB-SPLIT-99' }),
    });
    const d2 = await p2.json();
    assert.strictEqual(d2.payment.status, 'pending');
    assert.strictEqual(d2.order_paid, false);

    // Confirm Payment 2 as Manager -> total now 600 ETB -> order paid
    const p2Confirm = await fetch(`${baseUrl}/api/payments/${d2.payment.id}/confirm`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenManager}` },
    });
    const d2Conf = await p2Confirm.json();
    assert.strictEqual(d2Conf.payment.status, 'confirmed');
    assert.strictEqual(d2Conf.order_paid, true);

    const { rows: orderCheck } = await db.query('SELECT payment_status FROM orders WHERE id = $1', [splitOrderId]);
    assert.strictEqual(orderCheck[0].payment_status, 'paid');
  });

  test('Shift closing: blocked when unconfirmed payments exist unless manager note & PIN provided', async () => {
    // Open a cash drawer session
    const openRes = await fetch(`${baseUrl}/api/cash-drawer/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCashier}` },
      body: JSON.stringify({ starting_cash: 1000 }),
    });
    assert.strictEqual(openRes.status, 200);

    // Create an unconfirmed mobile-money payment in this shift
    await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCashier}` },
      body: JSON.stringify({ method: 'telebirr', amount: 350, reference: 'TB-UNCONFIRMED-SHIFT-1' }),
    });

    // Attempt to close without manager note -> rejected
    const closeFail = await fetch(`${baseUrl}/api/cash-drawer/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCashier}` },
      body: JSON.stringify({ actual_cash: 1000 }),
    });
    assert.strictEqual(closeFail.status, 400);
    const failBody = await closeFail.json();
    assert.match(failBody.error, /without a manager note/i);

    // Close with manager note and manager PIN -> succeeds
    const closeSuccess = await fetch(`${baseUrl}/api/cash-drawer/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCashier}` },
      body: JSON.stringify({
        actual_cash: 1000,
        notes: 'Customer transferred via Telebirr; network SMS delayed. Customer phone verified.',
        manager_pin: managerPin,
      }),
    });
    assert.strictEqual(closeSuccess.status, 200);
    const closedData = await closeSuccess.json();
    assert.strictEqual(closedData.status, 'closed');
    assert.ok(closedData.unconfirmed_payments_count > 0);
  });

  test('Payment refund: creates negative payment, requires manager PIN & reason, and logs audit', async () => {
    // Get confirmed payment from order 901
    const { rows } = await db.query(
      `SELECT * FROM payments WHERE restaurant_id = $1 AND status = 'confirmed' AND amount > 0 LIMIT 1`,
      [restId]
    );
    const originalPayment = rows[0];

    const refundRes = await fetch(`${baseUrl}/api/payments/${originalPayment.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenManager}` },
      body: JSON.stringify({
        manager_pin: managerPin,
        reason: 'Customer cancelled meal due to emergency',
      }),
    });

    assert.strictEqual(refundRes.status, 200);
    const refData = await refundRes.json();
    assert.strictEqual(refData.refund.original_payment_id, originalPayment.id);
    assert.strictEqual(Number(refData.refund.amount), -Number(originalPayment.amount));

    // Verify original payment marked refunded
    const { rows: origCheck } = await db.query('SELECT status FROM payments WHERE id = $1', [originalPayment.id]);
    assert.strictEqual(origCheck[0].status, 'refunded');

    // Verify audit log
    const { rows: auditRows } = await db.query(
      `SELECT * FROM audit_logs WHERE restaurant_id = $1 AND action = 'payment_refunded' ORDER BY created_at DESC LIMIT 1`,
      [restId]
    );
    assert.ok(auditRows.length > 0);
  });

  test('Statement reconciliation: manager marks payment as matched with statement', async () => {
    // Create and confirm a mobile money payment to reconcile
    const p = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}` },
      body: JSON.stringify({ method: 'cbe_birr', amount: 850, reference: 'CBE-RECON-1001' }),
    });
    const pData = await p.json();
    await fetch(`${baseUrl}/api/payments/${pData.payment.id}/confirm`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenManager}` },
    });

    // Mark matched
    const matchRes = await fetch(`${baseUrl}/api/payments/${pData.payment.id}/match`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenManager}` },
      body: JSON.stringify({ matched: true }),
    });

    assert.strictEqual(matchRes.status, 200);
    const matchedPayment = await matchRes.json();
    assert.strictEqual(matchedPayment.is_matched_with_statement, true);

    // Query reconciliation endpoint
    const reconRes = await fetch(`${baseUrl}/api/payments/reconciliation`, {
      headers: { Authorization: `Bearer ${tokenManager}` },
    });
    assert.strictEqual(reconRes.status, 200);
    const reconData = await reconRes.json();
    assert.ok(reconData.matched_amount >= 850);
  });

  test('GET /api/reports/payments returns daily methods, shifts, unconfirmed metrics, and reconciliation', async () => {
    const repRes = await fetch(`${baseUrl}/api/reports/payments`, {
      headers: { Authorization: `Bearer ${tokenManager}` },
    });
    assert.strictEqual(repRes.status, 200);
    const repData = await repRes.json();

    assert.ok(Array.isArray(repData.daily_by_method));
    assert.ok(Array.isArray(repData.shifts));
    assert.ok(typeof repData.unconfirmed.total_amount === 'number');
    assert.ok(typeof repData.reconciliation.matched_amount === 'number');
  });
});

describe('🔌 Stage 2: Provider Adapters, Encryption, Webhooks & Expiry', () => {
  test('AES-256-GCM encrypts and decrypts credentials with zero plain-text leaks', () => {
    const rawCreds = { app_id: 'tele_app_998', app_key: 'super_secret_key_xyz', short_code: '123456' };
    const encrypted = encryptCredentials(rawCreds);

    assert.strictEqual(typeof encrypted, 'string');
    assert.strictEqual(encrypted.includes('super_secret_key_xyz'), false); // never in plain text

    const decrypted = decryptCredentials(encrypted);
    assert.deepStrictEqual(decrypted, rawCreds);
  });

  test('Configures provider credentials and tests connection via Settings', async () => {
    // Configure mock sandbox provider
    const cfgRes = await fetch(`${baseUrl}/api/payments/providers/mock_sandbox`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}` },
      body: JSON.stringify({
        is_enabled: true,
        is_sandbox: true,
        credentials: { api_key: 'sandbox_test_key_abc', webhook_secret: 'wh_secret_123' },
      }),
    });

    assert.strictEqual(cfgRes.status, 200);
    const cfg = await cfgRes.json();
    assert.strictEqual(cfg.is_enabled, true);

    // Test connection
    const testRes = await fetch(`${baseUrl}/api/payments/providers/mock_sandbox/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}` },
      body: JSON.stringify({ is_sandbox: true }),
    });

    assert.strictEqual(testRes.status, 200);
    const testResult = await testRes.json();
    assert.strictEqual(testResult.success, true);
  });

  test('Feature flag: instant disable blocks provider usage', async () => {
    // Disable mock sandbox
    await fetch(`${baseUrl}/api/payments/providers/mock_sandbox`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}` },
      body: JSON.stringify({ is_enabled: false }),
    });

    const { getPaymentAdapter } = require('../adapters');
    await assert.rejects(
      async () => await getPaymentAdapter(restId, 'mock_sandbox', db),
      /currently disabled/i
    );

    // Re-enable for subsequent tests
    await fetch(`${baseUrl}/api/payments/providers/mock_sandbox`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}` },
      body: JSON.stringify({ is_enabled: true, is_sandbox: true }),
    });
  });

  test('Webhook processing: idempotent handling and state transition to paid', async () => {
    // Create an initiated payment awaiting webhook
    const txRef = 'MOCK-TX-WEBHOOK-101';
    const { rows: payRows } = await db.query(
      `INSERT INTO payments (restaurant_id, method, amount, currency, reference, provider, status)
       VALUES ($1, 'telebirr', 250.00, 'ETB', $2, 'mock_sandbox', 'pending')
       RETURNING id`,
      [restId, txRef]
    );

    const webhookPayload = {
      eventId: 'EVT-UNIQUE-101',
      reference: txRef,
      amount: 250.00,
      currency: 'ETB',
      status: 'paid',
    };

    // First webhook delivery
    const wh1 = await fetch(`${baseUrl}/api/webhooks/payments/mock_sandbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-id': 'EVT-UNIQUE-101',
        'signature': 'bypass_test_sig',
      },
      body: JSON.stringify(webhookPayload),
    });

    assert.strictEqual(wh1.status, 200);
    const wh1Data = await wh1.json();
    assert.strictEqual(wh1Data.status, 'success');

    // Verify payment updated to confirmed
    const { rows: verifiedPay } = await db.query('SELECT status FROM payments WHERE id = $1', [payRows[0].id]);
    assert.strictEqual(verifiedPay[0].status, 'confirmed');

    // Duplicate webhook delivery with same event ID -> returns already_processed (idempotent)
    const wh2 = await fetch(`${baseUrl}/api/webhooks/payments/mock_sandbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-id': 'EVT-UNIQUE-101',
      },
      body: JSON.stringify(webhookPayload),
    });

    assert.strictEqual(wh2.status, 200);
    const wh2Data = await wh2.json();
    assert.strictEqual(wh2Data.status, 'already_processed');
  });

  test('Webhook rejects amount or currency mismatch without modifying payment', async () => {
    const txRef = 'MOCK-TX-MISMATCH-202';
    const { rows: payRows } = await db.query(
      `INSERT INTO payments (restaurant_id, method, amount, currency, reference, provider, status)
       VALUES ($1, 'telebirr', 500.00, 'ETB', $2, 'mock_sandbox', 'pending')
       RETURNING id`,
      [restId, txRef]
    );

    // Webhook with tampered amount (e.g. 5.00 instead of 500.00)
    const whTamper = await fetch(`${baseUrl}/api/webhooks/payments/mock_sandbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-id': 'EVT-TAMPER-202',
        'signature': 'bypass_test_sig',
      },
      body: JSON.stringify({
        reference: txRef,
        amount: 5.00, // mismatch
        currency: 'ETB',
        status: 'paid',
      }),
    });

    assert.strictEqual(whTamper.status, 400);

    // Payment remains pending (never marked confirmed)
    const { rows: unchangedPay } = await db.query('SELECT status FROM payments WHERE id = $1', [payRows[0].id]);
    assert.strictEqual(unchangedPay[0].status, 'pending');
  });

  test('Scheduled background job: expires payments stuck in pending > 15 minutes', async () => {
    // Create an old payment from 20 minutes ago
    const { rows: oldPay } = await db.query(
      `INSERT INTO payments (restaurant_id, method, amount, currency, reference, provider, status, created_at)
       VALUES ($1, 'telebirr', 120.00, 'ETB', 'MOCK-STUCK-EXPIRE', 'mock_sandbox', 'pending', NOW() - INTERVAL '20 minutes')
       RETURNING id`,
      [restId]
    );

    const result = await expireStalePendingPayments(db);
    assert.ok(result.totalChecked >= 1);

    const { rows: updated } = await db.query('SELECT status FROM payments WHERE id = $1', [oldPay[0].id]);
    assert.strictEqual(updated[0].status, 'expired');
  });
});

describe('🏢 Platform Subscription Billing Flow', () => {
  let subId;

  before(async () => {
    const { rows: plans } = await db.query('SELECT id FROM subscription_plans LIMIT 1');
    const { rows: subRows } = await db.query(
      `INSERT INTO subscriptions (restaurant_id, plan_id, status, current_period_end)
       VALUES ($1, $2, 'trial', NOW() + INTERVAL '3 days')
       RETURNING id`,
      [restId, plans[0].id]
    );
    subId = subRows[0].id;
  });

  test('Restaurant submits subscription payment proof and admin approves with sequential invoice', async () => {
    // Submit proof as restaurant owner
    const submitRes = await fetch(`${baseUrl}/api/billing/proofs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({
        amount: 1500,
        payment_method: 'telebirr',
        reference_number: 'SUB-TB-PRO-2026',
        subscription_id: subId,
        screenshot_url: '/api/private-uploads/payment-proofs/sub_proof.jpg',
      }),
    });

    assert.strictEqual(submitRes.status, 201);
    const subProof = await submitRes.json();
    assert.ok(subProof.id);

    // Platform admin approves
    const approveRes = await fetch(`${baseUrl}/api/admin/payments/${subProof.id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });

    assert.strictEqual(approveRes.status, 200);
    const approvalData = await approveRes.json();
    assert.ok(approvalData.invoice_number);
    assert.match(approvalData.invoice_number, /^INV-\d{4}-\d{5}$/);

    // Verify subscription extended
    const { rows: subCheck } = await db.query('SELECT status, current_period_end FROM subscriptions WHERE id = $1', [subId]);
    assert.strictEqual(subCheck[0].status, 'active');

    // Verify owner received notification with invoice number
    const { rows: notifCheck } = await db.query(
      `SELECT * FROM notifications WHERE restaurant_id = $1 AND type = 'billing' ORDER BY created_at DESC LIMIT 1`,
      [restId]
    );
    assert.ok(notifCheck.length > 0);
    assert.ok(notifCheck[0].message.includes(approvalData.invoice_number));
  });
});
