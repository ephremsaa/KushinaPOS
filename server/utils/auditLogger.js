const db = require('../config/db');

/**
 * Writes an audit_logs entry for sensitive operations.
 * @param {object} poolOrClient - pg Pool or Client (for use inside transactions)
 * @param {object} options
 * @param {string} [options.restaurant_id]
 * @param {string} [options.actor_user_id]
 * @param {string} [options.actor_admin_id]
 * @param {string} [options.actor_email]
 * @param {string} options.action
 * @param {string} [options.target_type]
 * @param {string} [options.target_id]
 * @param {object} [options.metadata]
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (val) => typeof val === 'string' && UUID_REGEX.test(val);

async function logAudit(poolOrClient, options = {}) {
  const {
    action,
    metadata = {}
  } = options;

  const restaurant_id = options.restaurant_id || options.restaurantId || null;
  const actor_user_id = options.actor_user_id || options.actorUserId || null;
  const actor_admin_id = options.actor_admin_id || options.actorAdminId || null;
  const actor_email = options.actor_email || options.actorEmail || null;
  const target_type = options.target_type || options.targetType || null;
  const target_id = options.target_id || options.targetId || null;

  const safeRestId = isUuid(restaurant_id) ? restaurant_id : null;
  const safeActorUserId = isUuid(actor_user_id) ? actor_user_id : null;
  const safeActorAdminId = isUuid(actor_admin_id) ? actor_admin_id : null;

  const runner = poolOrClient || db;
  try {
    const res = await runner.query(
      `INSERT INTO audit_logs 
        (restaurant_id, actor_user_id, actor_admin_id, actor_email, action, target_type, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
      [
        safeRestId,
        safeActorUserId,
        safeActorAdminId,
        actor_email || null,
        action,
        target_type || null,
        target_id ? String(target_id) : null,
        JSON.stringify(metadata || {})
      ]
    );
    return res.rows[0];
  } catch (err) {
    console.error(`⚠️ [AUDIT LOG ERROR] Failed to record action "${action}":`, err.message);
    return null;
  }
}

module.exports = { logAudit };
