const dns = require('dns').promises;
const net = require('net');

/**
 * Validates whether an outgoing webhook URL is safe against SSRF attacks.
 * Blocks: non-HTTPS, localhost, private IP ranges (RFC 1918), link-local/cloud metadata (169.254.x.x), IPv6 loopback/private.
 */
async function validateWebhookUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    return { isValid: false, reason: 'Invalid URL format' };
  }

  // 1. Must use HTTPS
  if (parsed.protocol !== 'https:') {
    return { isValid: false, reason: 'Webhook URL must use secure HTTPS protocol' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject explicit localhost and local domains
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { isValid: false, reason: 'Targeting localhost or internal domain names is forbidden' };
  }

  // 3. Resolve DNS to check underlying IP addresses
  try {
    const addresses = await dns.lookup(hostname, { all: true });

    for (const addr of addresses) {
      const ip = addr.address;
      if (isPrivateOrRestrictedIp(ip)) {
        return {
          isValid: false,
          reason: `Resolved target IP (${ip}) is in a private, loopback, or cloud-metadata network range`
        };
      }
    }
  } catch (err) {
    return { isValid: false, reason: `Could not resolve hostname '${hostname}': ${err.message}` };
  }

  return { isValid: true };
}

/**
 * Checks if an IP is private, loopback, or link-local
 */
function isPrivateOrRestrictedIp(ip) {
  const version = net.isIP(ip);
  if (!version) return true; // not valid IP -> block

  if (version === 4) {
    const parts = ip.split('.').map(Number);
    const [b0, b1, b2, b3] = parts;

    // Loopback 127.0.0.0/8
    if (b0 === 127) return true;
    // Current network 0.0.0.0/8
    if (b0 === 0) return true;
    // Private 10.0.0.0/8
    if (b0 === 10) return true;
    // Private 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // Private 192.168.0.0/16
    if (b0 === 192 && b1 === 168) return true;
    // Link-local & AWS/GCP metadata 169.254.0.0/16
    if (b0 === 169 && b1 === 254) return true;
    // Shared address space 100.64.0.0/10
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
    // Broadcast / Multicast
    if (b0 >= 224) return true;

    return false;
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    // Loopback ::1
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    // Unspecified ::
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
    // Unique local address fc00::/7 (fc00... or fd00...)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local fe80::/10
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    // IPv4-mapped IPv6 ::ffff:127.0.0.1
    if (lower.includes('::ffff:')) {
      const v4Part = lower.split('::ffff:')[1];
      if (v4Part && net.isIP(v4Part) === 4) {
        return isPrivateOrRestrictedIp(v4Part);
      }
    }

    return false;
  }

  return true;
}

module.exports = {
  validateWebhookUrl,
  isPrivateOrRestrictedIp,
};
