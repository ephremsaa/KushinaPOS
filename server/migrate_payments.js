const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Adding payment columns to orders...');
    
    // Add payment_reference if it doesn't exist
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS payment_reference TEXT,
      ADD COLUMN IF NOT EXISTS is_payment_confirmed BOOLEAN DEFAULT false
    `);
    
    // Update existing orders to have is_payment_confirmed true if they are paid with cash or card
    // For older ones without method, just set to true if paid
    await client.query(`
      UPDATE orders 
      SET is_payment_confirmed = true 
      WHERE payment_status = 'paid' 
        AND (payment_method IN ('cash', 'card') OR payment_method IS NULL)
    `);

    // Ensure superadmin subscriptions table has payment_reference
    await client.query(`
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS manual_payment_reference TEXT,
      ADD COLUMN IF NOT EXISTS manual_receipt_url TEXT,
      ADD COLUMN IF NOT EXISTS manual_payment_status TEXT DEFAULT 'pending'
    `);
    
    await client.query('COMMIT');
    console.log('Migration successful.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
