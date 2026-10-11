const pool = require('../config/db');
const { decryptCredentials } = require('../utils/paymentCrypto');
const TelebirrAdapter = require('./telebirrAdapter');
const CbeBirrAdapter = require('./cbeBirrAdapter');
const ChapaAdapter = require('./chapaAdapter');
const MockSandboxAdapter = require('./mockSandboxAdapter');

const ADAPTER_MAP = {
  telebirr: TelebirrAdapter,
  cbe_birr: CbeBirrAdapter,
  chapa: ChapaAdapter,
  mock_sandbox: MockSandboxAdapter,
};

function getAdapterClass(providerName) {
  const normalized = (providerName || '').toLowerCase().trim();
  const AdapterClass = ADAPTER_MAP[normalized];
  if (!AdapterClass) {
    throw new Error(`Unsupported payment provider adapter: ${providerName}`);
  }
  return AdapterClass;
}

function instantiateAdapter(providerName, credentials = {}, isSandbox = true) {
  const AdapterClass = getAdapterClass(providerName);
  return new AdapterClass(credentials, isSandbox);
}

/**
 * Resolves configured and decrypted payment provider adapter for a tenant restaurant.
 * Enforces per-restaurant feature flag (is_enabled).
 */
async function getPaymentAdapter(restaurantId, providerName, client = null) {
  const db = client || pool;
  const { rows } = await db.query(
    `SELECT * FROM restaurant_payment_configs WHERE restaurant_id = $1 AND provider = $2`,
    [restaurantId, providerName]
  );

  if (rows.length === 0) {
    throw new Error(`Provider '${providerName}' is not configured for this restaurant.`);
  }

  const config = rows[0];
  if (!config.is_enabled) {
    throw new Error(`Provider '${providerName}' is currently disabled for this restaurant.`);
  }

  const decryptedCredentials = config.encrypted_credentials
    ? decryptCredentials(config.encrypted_credentials)
    : {};

  return instantiateAdapter(config.provider, decryptedCredentials, config.is_sandbox);
}

module.exports = {
  getPaymentAdapter,
  instantiateAdapter,
  getAdapterClass,
  ADAPTER_MAP,
};
