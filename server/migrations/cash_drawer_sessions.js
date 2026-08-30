const { pool } = require('../db');

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create the cash_drawer_sessions table
    await client.query(`
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
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
        notes TEXT
      );
    `);

    // Add tip_amount and till_session_id to orders if they don't exist
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS till_session_id UUID REFERENCES cash_drawer_sessions(id) ON DELETE SET NULL;
    `);

    await client.query('COMMIT');
    console.log('Migration completed: cash_drawer_sessions created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE orders 
      DROP COLUMN IF EXISTS tip_amount,
      DROP COLUMN IF EXISTS till_session_id;
    `);

    await client.query('DROP TABLE IF EXISTS cash_drawer_sessions;');
    
    await client.query('COMMIT');
    console.log('Rollback completed: cash_drawer_sessions removed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { up, down };
