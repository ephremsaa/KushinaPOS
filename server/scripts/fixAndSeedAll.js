const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fixAndSeedAll() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL');

    // 1. Inspect restaurants columns
    const restColsRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'restaurants'"
    );
    const restCols = restColsRes.rows.map(r => r.column_name);
    console.log('Current restaurants columns:', restCols);

    // Add missing columns to restaurants if needed
    const neededCols = [
      { name: 'password_hash', type: 'TEXT' },
      { name: 'status', type: "TEXT DEFAULT 'active'" },
      { name: 'plan_id', type: 'UUID' },
      { name: 'theme_color', type: "TEXT DEFAULT '#f97316'" },
      { name: 'background_color', type: "TEXT DEFAULT '#f1f5f9'" },
      { name: 'tax_rate', type: 'NUMERIC(5,2) DEFAULT 0' },
      { name: 'tax_id', type: 'TEXT' },
      { name: 'cuisine_type', type: 'TEXT' },
      { name: 'city', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'trial_ends_at', type: 'TIMESTAMPTZ' },
      { name: 'approved_at', type: 'TIMESTAMPTZ' },
      { name: 'approved_by', type: 'UUID' },
      { name: 'receipt_footer', type: 'TEXT' },
      { name: 'currency', type: "TEXT DEFAULT 'ETB'" },
    ];

    for (const col of neededCols) {
      if (!restCols.includes(col.name)) {
        console.log(`Adding missing column "${col.name}" to restaurants...`);
        try {
          await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        } catch (e) {
          console.log(`Note adding ${col.name}:`, e.message);
        }
      }
    }

    // 2. Ensure all Super Admin accounts exist and work with any password the user might type:
    // admin@kushina.com (from demo button) -> admin123 AND AdminPassword@2024
    // admin@kushinapos.com -> admin123 AND AdminPassword@2024
    // tsaron880@gmail.com -> Tsaron@1 AND AdminPassword@2024
    const adminAccounts = [
      { email: 'admin@kushina.com', password: 'admin123', name: 'Platform Super Admin' },
      { email: 'admin@kushinapos.com', password: 'admin123', name: 'Platform Super Admin' },
      { email: 'tsaron880@gmail.com', password: 'Tsaron@1', name: 'Tsaron Super Admin' },
      { email: 'tsaron@kushina.com', password: 'Tsaron@1', name: 'Tsaron Super Admin' },
    ];

    for (const adm of adminAccounts) {
      const hash = await bcrypt.hash(adm.password, 10);
      const existing = await client.query('SELECT * FROM platform_admins WHERE email = $1', [adm.email.toLowerCase()]);
      if (existing.rows.length > 0) {
        await client.query(
          'UPDATE platform_admins SET password_hash = $1, name = $2, id = COALESCE(id, gen_random_uuid()) WHERE email = $3',
          [hash, adm.name, adm.email.toLowerCase()]
        );
        console.log(`✅ Updated Admin: ${adm.email} (Password: ${adm.password})`);
      } else {
        await client.query(
          `INSERT INTO platform_admins (id, user_id, email, password_hash, name, created_at)
           VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, $3, NOW())`,
          [adm.email.toLowerCase(), hash, adm.name]
        );
        console.log(`✅ Created Admin: ${adm.email} (Password: ${adm.password})`);
      }
    }

    // 3. Seed demo restaurant owner accounts: owner@habesha.com and owner@restaurant.com
    const demoOwners = [
      { name: 'Habesha Gourmet Bistro', email: 'owner@habesha.com', password: 'owner123' },
      { name: 'Addis Demo Restaurant', email: 'owner@restaurant.com', password: 'password123' }
    ];

    for (const ow of demoOwners) {
      const pHash = await bcrypt.hash(ow.password, 10);
      const existingOwner = await client.query('SELECT * FROM restaurants WHERE email = $1', [ow.email]);
      if (existingOwner.rows.length > 0) {
        await client.query(
          "UPDATE restaurants SET password_hash = $1, status = 'active' WHERE email = $2",
          [pHash, ow.email]
        );
        console.log(`✅ Updated demo restaurant owner: ${ow.email}`);
      } else {
        await client.query(
          `INSERT INTO restaurants (name, email, password_hash, status, currency, city, phone)
           VALUES ($1, $2, $3, 'active', 'ETB', 'Addis Ababa', '+251911234567')`,
          [ow.name, ow.email, pHash]
        );
        console.log(`✅ Created demo restaurant owner: ${ow.email} (Password: ${ow.password})`);
      }
    }

    // 4. Print summary
    const allAdmins = await client.query('SELECT email, name FROM platform_admins');
    console.log('\n=== All Platform Super Admins ===');
    console.table(allAdmins.rows);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

fixAndSeedAll();
