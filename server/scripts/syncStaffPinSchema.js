const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function syncStaffSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database for staff schema sync...');

    // 1. Ensure all expected columns exist
    await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS name TEXT;`);
    await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS full_name TEXT;`);
    await client.query(`ALTER TABLE staff ALTER COLUMN full_name DROP NOT NULL;`);
    await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin_hash TEXT;`);
    await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
    await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone TEXT;`);
    await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS deactivation_note TEXT;`);

    // 2. Sync name <-> full_name
    await client.query(`UPDATE staff SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;`);
    await client.query(`UPDATE staff SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;`);

    // 3. Check if pin_code exists and migrate to pin_hash if pin_hash is null
    const { rows: staffWithPinCode } = await client.query(`
      SELECT id, pin_code FROM staff WHERE pin_code IS NOT NULL AND pin_hash IS NULL
    `);
    for (const s of staffWithPinCode) {
      if (s.pin_code) {
        const hash = await bcrypt.hash(String(s.pin_code), 10);
        await client.query(`UPDATE staff SET pin_hash = $1 WHERE id = $2`, [hash, s.id]);
      }
    }

    console.log('✅ Staff schema successfully synchronized!');
  } catch (err) {
    console.error('Error syncing staff schema:', err);
  } finally {
    await client.end();
  }
}

syncStaffSchema();
