const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fixSubscriptions() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to DB');

    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions'");
    const cols = res.rows.map(r => r.column_name);
    console.log('Subscriptions columns:', cols);

    if (!cols.includes('plan_id')) {
      console.log('Adding "plan_id" column to subscriptions...');
      await client.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id UUID');
    }

    if (!cols.includes('restaurant_id')) {
      console.log('Adding "restaurant_id" column to subscriptions...');
      await client.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS restaurant_id UUID');
    }

    if (!cols.includes('status')) {
      console.log('Adding "status" column to subscriptions...');
      await client.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'trial'");
    }

    if (!cols.includes('billing_cycle')) {
      console.log('Adding "billing_cycle" column to subscriptions...');
      await client.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'");
    }

    if (!cols.includes('current_period_start')) {
      await client.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ DEFAULT NOW()");
    }

    if (!cols.includes('current_period_end')) {
      await client.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')");
    }

    console.log('✅ Subscriptions table verified and updated.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

fixSubscriptions();
