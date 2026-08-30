require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const sql = `
  -- Failed payment tracking (set/cleared by admin on proof review)
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN DEFAULT FALSE;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS payment_failed_reason TEXT;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

  -- Cancellation intent (cancel at end of billing period)
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
`;

pool.query(sql)
  .then(() => {
    console.log('✅ Billing enhancements migration complete');
    pool.end();
  })
  .catch((e) => {
    console.error('❌ Migration failed:', e.message);
    pool.end();
    process.exit(1);
  });
