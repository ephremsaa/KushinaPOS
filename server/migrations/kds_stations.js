require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Add station column to menu_items
    await client.query(`
      ALTER TABLE menu_items 
      ADD COLUMN IF NOT EXISTS station TEXT NOT NULL DEFAULT 'General';
    `);

    // Add station column to order_items
    await client.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS station TEXT NOT NULL DEFAULT 'General';
    `);

    await client.query('COMMIT');
    console.log('✅ KDS Stations migration successful');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
