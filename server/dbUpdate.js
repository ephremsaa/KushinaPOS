const { Client } = require('pg');
require('dotenv').config();
const db = new Client({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kushina_pos' });

async function run() {
  await db.connect();
  try {
    await db.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS till_session_id UUID;
      
      CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        shift_id UUID REFERENCES staff_shifts(id) ON DELETE SET NULL,
        opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMPTZ,
        starting_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
        actual_cash NUMERIC(10,2),
        expected_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
        discrepancy_amount NUMERIC(10,2),
        manager_signoff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'open',
        notes TEXT
      );
    `);
    console.log('DB Updated');
  } catch(e) {
    console.error(e);
  } finally {
    await db.end();
  }
}
run();
