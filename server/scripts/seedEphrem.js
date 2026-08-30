const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkAndCreateUser() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to DB');

    const email = 'ephremsahle7@icloud.com';
    const password = 'Efo@sal1';

    // 1. Search across tables
    const r1 = await client.query("SELECT * FROM restaurants WHERE email ILIKE '%ephrem%'");
    console.log('Existing restaurants with ephrem:', r1.rows);

    const r2 = await client.query("SELECT * FROM platform_admins WHERE email ILIKE '%ephrem%'");
    console.log('Existing platform_admins with ephrem:', r2.rows);

    const r3 = await client.query("SELECT * FROM staff WHERE email ILIKE '%ephrem%'");
    console.log('Existing staff with ephrem:', r3.rows);

    // 2. Hash the password
    const hash = await bcrypt.hash(password, 10);

    // 3. Create or update in platform_admins (Super Admin)
    const existingAdmin = await client.query('SELECT * FROM platform_admins WHERE email = $1', [email]);
    if (existingAdmin.rows.length > 0) {
      await client.query('UPDATE platform_admins SET password_hash = $1, name = $2 WHERE email = $3', [hash, 'Ephrem Sahle', email]);
      console.log('✅ Updated Super Admin for:', email);
    } else {
      await client.query(
        'INSERT INTO platform_admins (id, user_id, email, password_hash, name, created_at) VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, $3, NOW())',
        [email, hash, 'Ephrem Sahle']
      );
      console.log('✅ Created Super Admin account for:', email);
    }

    // 4. Also create or update a restaurant owner account for ephremsahle7@icloud.com so they can access both restaurant POS and admin!
    const existingRest = await client.query('SELECT * FROM restaurants WHERE email = $1', [email]);
    if (existingRest.rows.length > 0) {
      await client.query("UPDATE restaurants SET password_hash = $1, status = 'active' WHERE email = $2", [hash, email]);
      console.log('✅ Updated Restaurant Owner account for:', email);
    } else {
      await client.query(
        `INSERT INTO restaurants (name, email, password_hash, status, currency, city, phone)
         VALUES ('Ephrem Gourmet Restaurant', $1, $2, 'active', 'ETB', 'Addis Ababa', '+251911234567')`,
        [email, hash]
      );
      console.log('✅ Created Restaurant Owner account for:', email);
    }

    console.log('\n🎉 User ephremsahle7@icloud.com successfully configured!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
}

checkAndCreateUser();
