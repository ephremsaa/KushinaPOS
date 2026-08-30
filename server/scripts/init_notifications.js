require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/db');

async function initDb() {
  try {
    console.log('Running notifications table migration...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        type          TEXT NOT NULL CHECK (type IN ('low_stock','payment_failed','new_reservation','order_stuck','staff_anomaly','new_online_order','billing')),
        title         TEXT NOT NULL,
        message       TEXT NOT NULL,
        target_role   TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('owner','manager','cashier','kitchen','waiter','all')),
        user_id       UUID REFERENCES staff(id) ON DELETE CASCADE,
        channel       TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','sms')),
        metadata      JSONB NOT NULL DEFAULT '{}',
        read_by       JSONB NOT NULL DEFAULT '[]',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        alert_type    TEXT NOT NULL CHECK (alert_type IN ('low_stock','payment_failed','new_reservation','order_stuck','staff_anomaly','new_online_order','billing')),
        in_app        BOOLEAN NOT NULL DEFAULT TRUE,
        email         BOOLEAN NOT NULL DEFAULT FALSE,
        sms           BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(restaurant_id, alert_type)
      );
    `);
    console.log('✅ Notifications DB tables initialized successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

initDb();
