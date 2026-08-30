const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant, requireOwner } = require('../middleware/auth');
const { notify } = require('../utils/notifyService');
const router = express.Router();

router.use(authenticate, requireTenant);

const tid = (req) => req.user.restaurantId;
const uid = (req) => req.user.id || req.user.userId;
const getRole = (req) => req.user.staffRole || (req.user.role === 'restaurant_owner' ? 'owner' : 'cashier');

// ── GET /api/notifications ────────────────────────────────────
// Returns notifications filtered by user role and calculates unread count
router.get('/', async (req, res) => {
  const restaurantId = tid(req);
  const userId = uid(req);
  const userRole = getRole(req);

  try {
    const { rows } = await db.query(
      `SELECT * FROM notifications
       WHERE restaurant_id = $1
         AND (target_role = 'all' OR target_role = $2 OR user_id = $3)
       ORDER BY created_at DESC
       LIMIT 100`,
      [restaurantId, userRole, userId]
    );

    // Calculate unread count per user
    const formatted = rows.map((n) => {
      const readBy = Array.isArray(n.read_by) ? n.read_by : (typeof n.read_by === 'string' ? JSON.parse(n.read_by) : []);
      const isRead = readBy.includes(userId);
      return {
        ...n,
        is_read: isRead,
        read_by: readBy,
      };
    });

    const unreadCount = formatted.filter((n) => !n.is_read).length;

    res.json({
      notifications: formatted,
      unreadCount,
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ── PATCH /api/notifications/:id/read ─────────────────────────
// Mark single notification as read for current user
router.patch('/:id/read', async (req, res) => {
  const restaurantId = tid(req);
  const userId = uid(req);
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      'SELECT read_by FROM notifications WHERE id = $1 AND restaurant_id = $2',
      [id, restaurantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    let readBy = Array.isArray(rows[0].read_by) ? rows[0].read_by : (typeof rows[0].read_by === 'string' ? JSON.parse(rows[0].read_by) : []);
    if (!readBy.includes(userId)) {
      readBy.push(userId);
      await db.query(
        'UPDATE notifications SET read_by = $1 WHERE id = $2 AND restaurant_id = $3',
        [JSON.stringify(readBy), id, restaurantId]
      );
    }

    res.json({ success: true, id, readBy });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// ── POST /api/notifications/read-all ──────────────────────────
// Mark all notifications as read for current user
router.post('/read-all', async (req, res) => {
  const restaurantId = tid(req);
  const userId = uid(req);
  const userRole = getRole(req);

  try {
    const { rows } = await db.query(
      `SELECT id, read_by FROM notifications
       WHERE restaurant_id = $1 AND (target_role = 'all' OR target_role = $2 OR user_id = $3)`,
      [restaurantId, userRole, userId]
    );

    for (const row of rows) {
      let readBy = Array.isArray(row.read_by) ? row.read_by : (typeof row.read_by === 'string' ? JSON.parse(row.read_by) : []);
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await db.query(
          'UPDATE notifications SET read_by = $1 WHERE id = $2',
          [JSON.stringify(readBy), row.id]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: 'Failed to mark all notifications read' });
  }
});

// ── GET /api/notifications/preferences ────────────────────────
// Retrieve tenant notification channel preferences
router.get('/preferences', async (req, res) => {
  const restaurantId = tid(req);

  const defaultTypes = [
    { alert_type: 'low_stock',        in_app: true, email: true,  sms: false },
    { alert_type: 'payment_failed',   in_app: true, email: true,  sms: true },
    { alert_type: 'new_reservation',  in_app: true, email: false, sms: false },
    { alert_type: 'order_stuck',      in_app: true, email: false, sms: true },
    { alert_type: 'staff_anomaly',    in_app: true, email: false, sms: false },
    { alert_type: 'new_online_order', in_app: true, email: false, sms: false },
    { alert_type: 'billing',          in_app: true, email: true,  sms: false },
  ];

  try {
    const { rows } = await db.query(
      'SELECT alert_type, in_app, email, sms FROM notification_preferences WHERE restaurant_id = $1',
      [restaurantId]
    );

    const map = new Map(rows.map((r) => [r.alert_type, r]));

    const preferences = defaultTypes.map((def) => {
      const existing = map.get(def.alert_type);
      return existing ? { ...def, ...existing } : def;
    });

    res.json(preferences);
  } catch (err) {
    console.error('Error fetching notification preferences:', err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// ── PUT /api/notifications/preferences ────────────────────────
// Update notification preferences per alert type
router.put('/preferences', requireOwner, async (req, res) => {
  const restaurantId = tid(req);
  const { preferences } = req.body; // Array of { alert_type, in_app, email, sms }

  if (!Array.isArray(preferences)) {
    return res.status(400).json({ error: 'preferences array required' });
  }

  try {
    for (const pref of preferences) {
      const { alert_type, in_app, email, sms } = pref;
      await db.query(
        `INSERT INTO notification_preferences (restaurant_id, alert_type, in_app, email, sms, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (restaurant_id, alert_type)
         DO UPDATE SET in_app = $3, email = $4, sms = $5, updated_at = NOW()`,
        [restaurantId, alert_type, !!in_app, !!email, !!sms]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating notification preferences:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ── POST /api/notifications/test-trigger ──────────────────────
// Test route for creating sample notifications
router.post('/test-trigger', async (req, res) => {
  const restaurantId = tid(req);
  const { type = 'low_stock' } = req.body;

  const testAlerts = {
    low_stock: {
      title: '⚠️ Low Stock Warning: Espresso Coffee Beans',
      message: 'Quantity has dropped to 2.5 kg (Threshold: 5.0 kg). Reorder recommended.',
      target_role: 'manager',
      metadata: { item_name: 'Espresso Coffee Beans', quantity: 2.5, threshold: 5.0 },
    },
    payment_failed: {
      title: '🚨 Payment Failure: Telebirr Proof Rejected',
      message: 'Your recent subscription transfer proof was rejected. Account grace period active.',
      target_role: 'owner',
      metadata: { grace_days: 7 },
    },
    new_reservation: {
      title: '📅 New Table Reservation Booked',
      message: 'Table #4 reserved for 6 guests at 7:30 PM (Customer: Dawit Tadesse).',
      target_role: 'cashier',
      metadata: { table_label: 'Table #4', guests: 6 },
    },
    order_stuck: {
      title: '⏱️ Kitchen Delay: Order #ORD-1092',
      message: 'Order has been in "preparing" status for 28 minutes (Threshold: 20 mins).',
      target_role: 'kitchen',
      metadata: { order_id: 'ORD-1092', duration_mins: 28 },
    },
    staff_anomaly: {
      title: '⏰ Staff Clock-In Anomaly',
      message: 'Cashier Abel Kebede clocked in 35 minutes past scheduled shift start.',
      target_role: 'manager',
      metadata: { staff_name: 'Abel Kebede', delay_mins: 35 },
    },
    new_online_order: {
      title: '🛍️ New Online Delivery Order Received',
      message: 'Order #ORD-1098 placed via web QR menu. 3 items (Total: 450.00 ETB).',
      target_role: 'all',
      metadata: { order_type: 'delivery', total: 450 },
    },
    billing: {
      title: '💳 Monthly Subscription Renewal Due',
      message: 'Your Growth Plan subscription renews in 3 days. Please review billing details.',
      target_role: 'owner',
      metadata: { plan_name: 'Growth' },
    },
  };

  const alert = testAlerts[type] || testAlerts.low_stock;

  try {
    const created = await notify({
      restaurant_id: restaurantId,
      type,
      title: alert.title,
      message: alert.message,
      target_role: alert.target_role,
      metadata: alert.metadata,
    });

    res.json({ success: true, notification: created });
  } catch (err) {
    console.error('Error triggering test alert:', err);
    res.status(500).json({ error: 'Failed to trigger test alert' });
  }
});

module.exports = router;
