const crypto = require('crypto');

/**
 * Generates an HMAC-SHA256 signature for a webhook delivery payload.
 * Follows standard timestamp-prepended signature:
 * signature = HMAC_SHA256(`${timestamp}.${payloadString}`, secret)
 */
function signWebhookPayload(payloadString, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const dataToSign = `${timestamp}.${payloadString}`;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');

  return {
    timestamp,
    signature: `t=${timestamp},v1=${hmac}`,
    rawHmac: hmac,
  };
}

/**
 * Verifies that a received webhook payload matches the signature header.
 */
function verifyWebhookSignature(payloadString, signatureHeader, secret, toleranceSeconds = 300) {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const timestamp = parseInt(parts.t, 10);
  const signature = parts.v1;

  if (!timestamp || !signature) return false;

  // Check timestamp drift
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payloadString}`)
    .digest('hex');

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch (err) {
    return false;
  }
}

/**
 * Generates a random secure secret for a webhook endpoint.
 */
function generateWebhookSecret() {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

module.exports = {
  signWebhookPayload,
  verifyWebhookSignature,
  generateWebhookSecret,
};
