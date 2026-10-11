const db = require('../config/db');
const { signWebhookPayload } = require('../utils/webhookSigner');
const { validateWebhookUrl } = require('../utils/ssrfValidator');
const { notify } = require('../utils/notifyService');

// Retry backoff schedule in seconds: [1m, 5m, 30m, 2h, 6h, 24h]
const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200, 21600, 86400];

/**
 * Dispatches an event to all active webhooks for a restaurant
 */
async function dispatchWebhookEvent(restaurantId, event, data) {
  if (!restaurantId || !event) return [];

  try {
    const { rows: webhooks } = await db.query(
      `SELECT id, url, secret, events, failure_count, max_failures 
       FROM webhooks 
       WHERE restaurant_id = $1 AND is_active = true AND $2 = ANY(events)`,
      [restaurantId, event]
    );

    if (webhooks.length === 0) return [];

    const deliveries = [];
    for (const wh of webhooks) {
      const payload = {
        event,
        data,
        timestamp: new Date().toISOString(),
      };

      const { rows: delRows } = await db.query(
        `INSERT INTO webhook_deliveries 
          (webhook_id, restaurant_id, event, payload, status, attempts, max_attempts)
         VALUES ($1, $2, $3, $4, 'retrying', 1, 6)
         RETURNING id`,
        [wh.id, restaurantId, event, JSON.stringify(payload)]
      );

      const deliveryId = delRows[0].id;
      deliveries.push(deliveryId);

      // Trigger delivery asynchronously
      deliverWebhookPayload(deliveryId, wh).catch(err => {
        console.error(`[WebhookDispatcher] Immediate delivery failed for ${deliveryId}:`, err.message);
      });
    }

    return deliveries;
  } catch (err) {
    console.error(`[WebhookDispatcher] Dispatch event ${event} error:`, err);
    return [];
  }
}

/**
 * Attempts delivery of a single webhook payload
 */
async function deliverWebhookPayload(deliveryId, webhookCache = null) {
  const { rows } = await db.query(
    `SELECT d.*, w.url, w.secret, w.failure_count, w.max_failures, w.name as webhook_name
     FROM webhook_deliveries d
     JOIN webhooks w ON w.id = d.webhook_id
     WHERE d.id = $1`,
    [deliveryId]
  );

  if (rows.length === 0) return false;
  const delivery = rows[0];

  // SSRF pre-flight validation
  const ssrfCheck = await validateWebhookUrl(delivery.url);
  if (!ssrfCheck.isValid) {
    await db.query(
      `UPDATE webhook_deliveries 
       SET status = 'failed', error_message = $1, updated_at = NOW() 
       WHERE id = $2`,
      [`SSRF validation rejected: ${ssrfCheck.reason}`, deliveryId]
    );
    return false;
  }

  const payloadString = typeof delivery.payload === 'string'
    ? delivery.payload
    : JSON.stringify(delivery.payload);

  const { timestamp, signature } = signWebhookPayload(payloadString, delivery.secret);

  const startTime = Date.now();
  let statusCode = null;
  let responseBody = null;
  let isSuccess = false;
  let errorMessage = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(delivery.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KushinaPOS-Webhooks/1.0',
        'X-Kushina-Signature': signature,
        'X-Kushina-Timestamp': String(timestamp),
        'X-Kushina-Event': delivery.event,
        'X-Kushina-Delivery': delivery.id,
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = res.status;
    isSuccess = res.status >= 200 && res.status < 300;

    const rawText = await res.text().catch(() => '');
    responseBody = rawText.slice(0, 1000); // capped at 1000 chars

    if (!isSuccess) {
      errorMessage = `Server responded with HTTP ${res.status}`;
    }
  } catch (err) {
    errorMessage = err.name === 'AbortError' ? 'Connection timed out after 10 seconds' : err.message;
  }

  const durationMs = Date.now() - startTime;

  if (isSuccess) {
    // Delivery succeeded
    await db.query(
      `UPDATE webhook_deliveries 
       SET status = 'success', status_code = $1, response_body = $2, duration_ms = $3, 
           error_message = NULL, next_retry_at = NULL, updated_at = NOW() 
       WHERE id = $4`,
      [statusCode, responseBody, durationMs, deliveryId]
    );

    // Reset failure counter on webhook
    await db.query(
      `UPDATE webhooks 
       SET failure_count = 0, last_delivered_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [delivery.webhook_id]
    );

    return true;
  } else {
    // Delivery failed -> handle backoff and auto-disable
    const currentAttempts = Number(delivery.attempts);
    const maxAttempts = Number(delivery.max_attempts) || 6;
    const newFailureCount = Number(delivery.failure_count) + 1;
    const maxFailures = Number(delivery.max_failures) || 10;

    let nextStatus = 'retrying';
    let nextRetryAt = null;

    if (currentAttempts < maxAttempts) {
      const delaySeconds = RETRY_DELAYS_SECONDS[currentAttempts - 1] || 86400;
      nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
    } else {
      nextStatus = 'failed';
    }

    await db.query(
      `UPDATE webhook_deliveries 
       SET status = $1, status_code = $2, response_body = $3, duration_ms = $4,
           error_message = $5, attempts = attempts + 1, next_retry_at = $6, updated_at = NOW() 
       WHERE id = $7`,
      [nextStatus, statusCode, responseBody, durationMs, errorMessage, nextRetryAt, deliveryId]
    );

    // Check auto-disable after repeated failures
    if (newFailureCount >= maxFailures) {
      await db.query(
        `UPDATE webhooks 
         SET is_active = false, auto_disabled_at = NOW(), failure_count = $1, updated_at = NOW() 
         WHERE id = $2`,
        [newFailureCount, delivery.webhook_id]
      );

      // Alert restaurant owner
      notify({
        restaurant_id: delivery.restaurant_id,
        type: 'billing',
        title: '⚠️ Webhook Endpoint Auto-Disabled',
        message: `Your webhook endpoint '${delivery.webhook_name}' (${delivery.url}) failed ${newFailureCount} consecutive delivery attempts and has been paused. Please review your server logs and re-enable it in Settings > Developers.`,
        target_role: 'owner',
        metadata: { webhook_id: delivery.webhook_id, url: delivery.url }
      }).catch(() => {});
    } else {
      await db.query(
        `UPDATE webhooks 
         SET failure_count = $1, updated_at = NOW() 
         WHERE id = $2`,
        [newFailureCount, delivery.webhook_id]
      );
    }

    return false;
  }
}

/**
 * Background worker: Processes pending retries
 */
async function processWebhookRetries() {
  try {
    const { rows } = await db.query(
      `SELECT d.id, d.webhook_id 
       FROM webhook_deliveries d
       JOIN webhooks w ON w.id = d.webhook_id
       WHERE d.status = 'retrying' 
         AND d.next_retry_at <= NOW() 
         AND w.is_active = true
       ORDER BY d.next_retry_at ASC
       LIMIT 50`
    );

    for (const row of rows) {
      await deliverWebhookPayload(row.id).catch(() => {});
    }

    return rows.length;
  } catch (err) {
    console.error('[WebhookDispatcher] Process retries error:', err);
    return 0;
  }
}

module.exports = {
  dispatchWebhookEvent,
  deliverWebhookPayload,
  processWebhookRetries,
  RETRY_DELAYS_SECONDS,
};
