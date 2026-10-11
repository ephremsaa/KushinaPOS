const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../index');
const db = require('../config/db');
const { generateV1ApiKey } = require('../middleware/apiKeyV1Auth');
const { signWebhookPayload, verifyWebhookSignature } = require('../utils/webhookSigner');
const { validateWebhookUrl } = require('../utils/ssrfValidator');
const { rateLimitBuckets } = require('../middleware/apiKeyV1Auth');

let server;
let baseUrl;

describe('🚀 Partner & Developer API v1, Scoped Keys & SSRF-Safe Webhooks', () => {
  let restAId, restBId;
  let keyAId, keyARaw;
  let keyBId, keyBRaw;
  let menuCategoryAId, menuItemAId;

  before(async () => {
    // 1. Start HTTP server on dynamic port
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 2. Ensure test restaurants A & B with Pro/Enterprise plan (api_access: true)
    const { rows: planRows } = await db.query(
      `SELECT id FROM subscription_plans WHERE LOWER(name) IN ('pro', 'enterprise') LIMIT 1`
    );
    const proPlanId = planRows[0]?.id;

    // Restaurant A
    const resA = await db.query(
      `INSERT INTO restaurants (name, slug, email, password_hash, phone, status, tax_rate)
       VALUES ('Partner API Test Restaurant A', 'api-test-rest-a', 'partner-a@kushinapos.com', 'hash_test_123', '+251911999901', 'active', 0)
       RETURNING id`
    );
    restAId = resA.rows[0].id;

    // Restaurant B (for cross-tenant testing)
    const resB = await db.query(
      `INSERT INTO restaurants (name, slug, email, password_hash, phone, status, tax_rate)
       VALUES ('Partner API Test Restaurant B', 'api-test-rest-b', 'partner-b@kushinapos.com', 'hash_test_123', '+251911999902', 'active', 0)
       RETURNING id`
    );
    restBId = resB.rows[0].id;

    if (proPlanId) {
      await db.query(
        `INSERT INTO subscriptions (restaurant_id, plan_id, status, current_period_end)
         VALUES ($1, $2, 'active', NOW() + INTERVAL '30 days'),
                ($3, $2, 'active', NOW() + INTERVAL '30 days')`,
        [restAId, proPlanId, restBId]
      );
    }

    // 3. Create Menu Item for Restaurant A
    const { rows: catRows } = await db.query(
      `INSERT INTO menu_categories (restaurant_id, name, sort_order)
       VALUES ($1, 'Authentic Dishes', 1) RETURNING id`,
      [restAId]
    );
    menuCategoryAId = catRows[0].id;

    const { rows: itemRows } = await db.query(
      `INSERT INTO menu_items (restaurant_id, category_id, name, price, is_available)
       VALUES ($1, $2, 'Special Doro Wat', 350.00, true) RETURNING id`,
      [restAId, menuCategoryAId]
    );
    menuItemAId = itemRows[0].id;

    // 4. Create Scoped API Key for Restaurant A
    const keyAGen = generateV1ApiKey();
    keyARaw = keyAGen.rawKey;
    const { rows: kARows } = await db.query(
      `INSERT INTO api_keys 
        (restaurant_id, name, key_hash, key_prefix, scopes, permissions, rate_limit_per_minute, is_active)
       VALUES ($1, 'Partner Integrations Key A', $2, $3, $4, $4, 60, true)
       RETURNING id`,
      [
        restAId,
        keyAGen.keyHash,
        keyAGen.keyPrefix,
        JSON.stringify(['menu:read', 'orders:read', 'orders:write', 'customers:read', 'reports:read'])
      ]
    );
    keyAId = kARows[0].id;

    // 5. Create Scoped API Key for Restaurant B
    const keyBGen = generateV1ApiKey();
    keyBRaw = keyBGen.rawKey;
    const { rows: kBRows } = await db.query(
      `INSERT INTO api_keys 
        (restaurant_id, name, key_hash, key_prefix, scopes, permissions, rate_limit_per_minute, is_active)
       VALUES ($1, 'Partner Integrations Key B', $2, $3, $4, $4, 60, true)
       RETURNING id`,
      [
        restBId,
        keyBGen.keyHash,
        keyBGen.keyPrefix,
        JSON.stringify(['menu:read', 'orders:read'])
      ]
    );
    keyBId = kBRows[0].id;
  });

  after(async () => {
    if (server) server.close();
    await db.query(`DELETE FROM restaurants WHERE id IN ($1, $2)`, [restAId, restBId]).catch(() => {});
  });

  describe('1. Authentication, Scopes & Error Formats', () => {
    it('returns 401 with standard error format and request_id when key is missing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/menu`);
      const body = await res.json();
      assert.equal(res.status, 401);
      assert.equal(body.error?.code, 'UNAUTHORIZED');
      assert.ok(body.request_id);
    });

    it('returns 401 when key is invalid', async () => {
      const res = await fetch(`${baseUrl}/api/v1/menu`, {
        headers: { Authorization: 'Bearer kpos_live_invalidkey123456' }
      });
      const body = await res.json();
      assert.equal(res.status, 401);
      assert.equal(body.error?.code, 'INVALID_API_KEY');
    });

    it('successfully retrieves menu using Bearer authorization', async () => {
      const res = await fetch(`${baseUrl}/api/v1/menu`, {
        headers: { Authorization: `Bearer ${keyARaw}` }
      });
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.categories));
      assert.ok(Array.isArray(body.items));
      assert.equal(body.items.some(i => i.name === 'Special Doro Wat'), true);
      assert.equal(body.restaurant.id, restAId);
    });

    it('enforces scope restrictions: Key B has only read scopes, cannot write orders', async () => {
      const res = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyBRaw}`
        },
        body: JSON.stringify({
          items: [{ menu_item_id: menuItemAId, quantity: 1 }]
        })
      });
      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.error?.code, 'INSUFFICIENT_SCOPE');
    });
  });

  describe('2. Rate Limiting (Sliding Window)', () => {
    it('returns X-RateLimit headers on valid requests', async () => {
      const res = await fetch(`${baseUrl}/api/v1/menu`, {
        headers: { Authorization: `Bearer ${keyARaw}` }
      });
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('x-ratelimit-limit'));
      assert.ok(res.headers.get('x-ratelimit-remaining'));
      assert.ok(res.headers.get('x-ratelimit-reset'));
    });

    it('returns HTTP 429 and Retry-After header when rate limit is exceeded', async () => {
      // Simulate exhausting the rate limit bucket for keyAId
      const now = Date.now();
      const exhausted = Array(65).fill(now);
      rateLimitBuckets.set(keyAId, exhausted);

      const res = await fetch(`${baseUrl}/api/v1/menu`, {
        headers: { Authorization: `Bearer ${keyARaw}` }
      });
      const body = await res.json();
      assert.equal(res.status, 429);
      assert.equal(body.error?.code, 'RATE_LIMIT_EXCEEDED');
      assert.ok(res.headers.get('retry-after'));

      // Reset bucket for remaining tests
      rateLimitBuckets.set(keyAId, []);
    });
  });

  describe('3. Order Creation, computeOrderTotals & Idempotency', () => {
    it('creates an order with server-verified prices and computes correct totals', async () => {
      const res = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyARaw}`
        },
        body: JSON.stringify({
          items: [{ menu_item_id: menuItemAId, quantity: 2 }],
          order_type: 'dine_in',
          customer_name: 'Dawit Bekele',
          customer_phone: '+251911223344'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.ok(body.order?.id);
      assert.equal(Number(body.order.subtotal), 700.00); // 2 * 350.00
      assert.equal(Number(body.order.total), 700.00);
      assert.equal(body.order.order_source, 'partner_api');
      assert.equal(body.order.restaurant_id, restAId);
    });

    it('enforces Idempotency-Key header so retry never duplicates order', async () => {
      const idemKey = `idem_test_${Date.now()}`;

      // First call
      const res1 = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyARaw}`,
          'Idempotency-Key': idemKey
        },
        body: JSON.stringify({
          items: [{ menu_item_id: menuItemAId, quantity: 1 }],
          customer_name: 'Solomon Tesfaye'
        })
      });

      const body1 = await res1.json();
      assert.equal(res1.status, 201);
      const originalOrderId = body1.order.id;

      // Second identical call with the same idempotency key
      const res2 = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyARaw}`,
          'Idempotency-Key': idemKey
        },
        body: JSON.stringify({
          items: [{ menu_item_id: menuItemAId, quantity: 1 }],
          customer_name: 'Solomon Tesfaye'
        })
      });

      const body2 = await res2.json();
      assert.equal(res2.status, 201);
      assert.equal(body2.order.id, originalOrderId);
      assert.equal(body2.idempotent_replay, true);
    });
  });

  describe('4. Order Status Transition Machine', () => {
    let testOrderId;

    before(async () => {
      const res = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyARaw}`
        },
        body: JSON.stringify({
          items: [{ menu_item_id: menuItemAId, quantity: 1 }]
        })
      });
      const body = await res.json();
      testOrderId = body.order.id;
    });

    it('allows valid state machine transition (pending -> preparing)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/orders/${testOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyARaw}`
        },
        body: JSON.stringify({ status: 'preparing' })
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.order.status, 'preparing');
    });

    it('blocks illegal status transition (preparing -> delivered)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/orders/${testOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyARaw}`
        },
        body: JSON.stringify({ status: 'delivered' })
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.error?.code, 'INVALID_TRANSITION');
    });
  });

  describe('5. Cross-Tenant Data Isolation', () => {
    it('Key for Restaurant B CANNOT view or access Restaurant A orders', async () => {
      const res = await fetch(`${baseUrl}/api/v1/orders`, {
        headers: { Authorization: `Bearer ${keyBRaw}` }
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      // Restaurant B should see none of Restaurant A orders
      for (const order of body.data) {
        assert.notEqual(order.restaurant_id, restAId);
      }
    });

    it('Restaurant A key cannot read Restaurant B order by id (404)', async () => {
      // Create an order specifically for Restaurant B
      const { rows: bOrderRows } = await db.query(
        `INSERT INTO orders (restaurant_id, local_id, status, subtotal, total, order_source)
         VALUES ($1, 'ORD-B-999', 'pending', 450.00, 450.00, 'partner_api')
         RETURNING id`,
        [restBId]
      );
      const orderBId = bOrderRows[0].id;

      // Restaurant A's API key attempts to fetch Restaurant B's order by ID
      const res = await fetch(`${baseUrl}/api/v1/orders/${orderBId}`, {
        headers: { Authorization: `Bearer ${keyARaw}` }
      });
      const body = await res.json();
      assert.equal(res.status, 404);
      assert.equal(body.error?.code, 'NOT_FOUND');
    });

    it('Key for Restaurant B CANNOT access Restaurant A menu', async () => {
      const res = await fetch(`${baseUrl}/api/v1/menu`, {
        headers: { Authorization: `Bearer ${keyBRaw}` }
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.restaurant.id, restBId);
      assert.equal(body.items.some(i => i.name === 'Special Doro Wat'), false);
    });
  });

  describe('6. Webhooks SSRF Security & HMAC Signing', () => {
    it('blocks unsafe SSRF targets: localhost, 127.0.0.1, AWS metadata, non-HTTPS', async () => {
      const checks = await Promise.all([
        validateWebhookUrl('http://example.com/webhook'), // non-HTTPS
        validateWebhookUrl('https://localhost:4000/webhook'), // localhost
        validateWebhookUrl('https://127.0.0.1/webhook'), // IPv4 loopback
        validateWebhookUrl('https://169.254.169.254/latest/meta-data'), // AWS link-local
        validateWebhookUrl('https://192.168.1.50:8080/callback'), // RFC 1918 private
      ]);

      for (const check of checks) {
        assert.equal(check.isValid, false);
      }
    });

    it('accepts legitimate public HTTPS webhook URL', async () => {
      const check = await validateWebhookUrl('https://webhook.site/test-endpoint');
      assert.equal(check.isValid, true);
    });

    it('generates cryptographic HMAC-SHA256 signature and verifies correctly', () => {
      const secret = 'whsec_test_secret_key_1234567890';
      const payload = JSON.stringify({ event: 'order.created', data: { id: 'order_123' } });

      const { signature, timestamp } = signWebhookPayload(payload, secret);
      assert.ok(signature.startsWith('t='));
      assert.ok(signature.includes(',v1='));

      const verified = verifyWebhookSignature(payload, signature, secret);
      assert.equal(verified, true);

      // Verify tampered payload fails
      const tamperedVerified = verifyWebhookSignature(payload + 'tampered', signature, secret);
      assert.equal(tamperedVerified, false);
    });

    it('verifies webhook signature using the exact documentation code snippet from DevelopersPage', () => {
      const crypto = require('crypto');
      const webhookSecret = 'whsec_test_secret_key_1234567890';
      const rawBody = JSON.stringify({ event: 'order.created', data: { id: 'order_123' } });

      const { signature: signatureHeader } = signWebhookPayload(rawBody, webhookSecret);

      // --- EXACT SNIPPET FROM DOCS EXAMPLE (DevelopersPage.tsx) ---
      const parts = signatureHeader.split(',');
      const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
      const signature = parts.find(p => p.startsWith('v1='))?.slice(3);

      const signedPayload = timestamp + '.' + rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
      // --- END DOCS SNIPPET ---

      assert.equal(isValid, true);
    });
  });

  describe('7. API Documentation Endpoints', () => {
    it('serves OpenAPI 3.1 schema at /api/v1/openapi.json', async () => {
      const res = await fetch(`${baseUrl}/api/v1/openapi.json`);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.openapi, '3.1.0');
      assert.ok(body.paths['/menu'] || body.paths['/api/v1/menu']);
      assert.ok(body.paths['/orders'] || body.paths['/api/v1/orders']);
    });

    it('serves interactive Swagger UI documentation at /api/v1/docs', async () => {
      const res = await fetch(`${baseUrl}/api/v1/docs`);
      const text = await res.text();
      assert.equal(res.status, 200);
      assert.ok(text.includes('SwaggerUIBundle'));
    });
  });

  describe('8. Platform Admin Suspension & Key Rotation', () => {
    it('platform admin can suspend a key, instantly blocking access with 403', async () => {
      await db.query(
        `UPDATE api_keys SET is_suspended_by_admin = true WHERE id = $1`,
        [keyAId]
      );

      const res = await fetch(`${baseUrl}/api/v1/menu`, {
        headers: { Authorization: `Bearer ${keyARaw}` }
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.error?.code, 'KEY_SUSPENDED');

      // Reinstate
      await db.query(
        `UPDATE api_keys SET is_suspended_by_admin = false WHERE id = $1`,
        [keyAId]
      );
    });
  });

  describe('9. Public Integration Request Lead Capture', () => {
    it('captures integration request lead and stores in database', async () => {
      const res = await fetch(`${baseUrl}/api/public/integration-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_name: 'Bole Traditional Restaurant',
          contact_name: 'Abebe Bikila',
          email: 'abebe@example.com',
          phone: '+251911002233',
          integration_name: 'Odoo ERP Integration',
          use_case_notes: 'Sync inventory and sales into central Odoo accounting daily.'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.request.integration_name, 'Odoo ERP Integration');
    });
  });
});
