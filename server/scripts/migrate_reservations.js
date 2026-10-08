const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log('Connecting to database to add reservations table...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Creating reservations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        table_id        UUID REFERENCES tables(id) ON DELETE SET NULL,
        customer_name   TEXT NOT NULL,
        customer_phone  TEXT NOT NULL,
        party_size      INT NOT NULL DEFAULT 2,
        reservation_time TIMESTAMPTZ NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','seated','cancelled','no_show')),
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('Successfully added reservations table.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding reservations table:', err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
