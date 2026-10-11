const crypto = require('crypto');

function getEncryptionKey() {
  const secret = process.env.PAYMENT_ENCRYPTION_KEY || process.env.JWT_SECRET || 'kushina-pos-payment-secret-salt-2026';
  return crypto.scryptSync(secret, 'kushina-pos-payment-salt', 32);
}

/**
 * Encrypts an object or string using AES-256-GCM.
 * Never stores plain-text credentials in the database.
 */
function encryptCredentials(data) {
  if (!data) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const plainText = typeof data === 'string' ? data : JSON.stringify(data);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag,
    encryptedData: encrypted,
  });
}

/**
 * Decrypts an AES-256-GCM payload in memory.
 * Never logged or exposed to the client.
 */
function decryptCredentials(payloadString) {
  if (!payloadString) return null;
  try {
    const { iv, authTag, encryptedData } = JSON.parse(payloadString);
    if (!iv || !authTag || !encryptedData) return null;

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (err) {
    console.error('Decryption error in paymentCrypto:', err.message);
    return null;
  }
}

/**
 * Masks credentials for UI inspection without leaking actual secret values.
 */
function maskCredentials(credentialsObj) {
  if (!credentialsObj || typeof credentialsObj !== 'object') return {};
  const masked = {};
  for (const [key, value] of Object.entries(credentialsObj)) {
    if (typeof value !== 'string') {
      masked[key] = value;
      continue;
    }
    if (value.length <= 6) {
      masked[key] = '••••••';
    } else {
      const visibleStart = value.slice(0, 3);
      const visibleEnd = value.slice(-3);
      masked[key] = `${visibleStart}••••••••${visibleEnd}`;
    }
  }
  return masked;
}

module.exports = {
  encryptCredentials,
  decryptCredentials,
  maskCredentials,
};
