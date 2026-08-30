const db = require('../config/db');

/**
 * Decoupled Notification Dispatcher Service
 * 
 * @param {Object} params
 * @param {string} params.restaurant_id - Tenant UUID
 * @param {string} params.type - Alert type ('low_stock' | 'payment_failed' | 'new_reservation' | 'order_stuck' | 'staff_anomaly' | 'new_online_order' | 'billing')
 * @param {string} params.title - Alert Title Header
 * @param {string} params.message - Detailed alert message body
 * @param {string} [params.target_role='all'] - Target role ('owner' | 'manager' | 'cashier' | 'kitchen' | 'waiter' | 'all')
 * @param {string} [params.user_id=null] - Specific target user UUID (optional)
 * @param {Object} [params.metadata={}] - Arbitrary context JSON metadata
 */
async function notify({ restaurant_id, type, title, message, target_role = 'all', user_id = null, metadata = {} }) {
  if (!restaurant_id || !type || !title || !message) {
    console.warn('[notifyService] Missing required parameters', { restaurant_id, type, title });
    return null;
  }

  try {
    // 1. Fetch channel preferences for this restaurant & alert_type
    const prefRes = await db.query(
      'SELECT in_app, email, sms FROM notification_preferences WHERE restaurant_id = $1 AND alert_type = $2',
      [restaurant_id, type]
    );

    let inAppEnabled = true;
    let emailEnabled = type === 'billing' || type === 'payment_failed';
    let smsEnabled = type === 'payment_failed' || type === 'order_stuck';

    if (prefRes.rows.length > 0) {
      inAppEnabled = prefRes.rows[0].in_app;
      emailEnabled = prefRes.rows[0].email;
      smsEnabled = prefRes.rows[0].sms;
    }

    let createdNotification = null;

    // 2. Dispatch In-App Notification if enabled
    if (inAppEnabled) {
      const insertRes = await db.query(
        `INSERT INTO notifications (restaurant_id, type, title, message, target_role, user_id, channel, metadata, read_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'in_app', $7, '[]')
         RETURNING *`,
        [restaurant_id, type, title, message, target_role, user_id, JSON.stringify(metadata)]
      );
      createdNotification = insertRes.rows[0];
    }

    // 3. Dispatch Email Alert if enabled
    if (emailEnabled) {
      console.log(`📧 [NOTIFY SERVICE - EMAIL DISPATCH] Type: ${type} | Tenant: ${restaurant_id} | Title: "${title}" | Message: "${message}"`);
    }

    // 4. Dispatch SMS Alert if enabled
    if (smsEnabled) {
      console.log(`📱 [NOTIFY SERVICE - SMS DISPATCH] Type: ${type} | Tenant: ${restaurant_id} | Title: "${title}" | Message: "${message}"`);
    }

    return createdNotification;
  } catch (err) {
    console.error('[notifyService] Error dispatching notification:', err);
    return null;
  }
}

module.exports = { notify };
