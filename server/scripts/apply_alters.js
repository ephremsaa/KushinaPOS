const pool = require('../config/db');

async function run() {
  try {
    await pool.query(`
      ALTER TABLE cash_drawer_sessions 
        ADD COLUMN IF NOT EXISTS shift_id UUID;

      ALTER TABLE restaurants 
        ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS payment_failed_reason TEXT,
        ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

      ALTER TABLE subscriptions 
        ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
    `);
    console.log('✅ Alter table statements executed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err);
    process.exit(1);
  }
}

run();
