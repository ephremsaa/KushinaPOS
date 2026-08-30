const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function createSuperAdmin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL');

    // 1. Ensure required columns exist on platform_admins
    const colsRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'platform_admins'"
    );
    const existingCols = colsRes.rows.map(r => r.column_name);
    console.log('Existing columns on platform_admins:', existingCols);

    if (!existingCols.includes('id')) {
      console.log('Adding "id" column to platform_admins...');
      await client.query('ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid()');
    }

    if (!existingCols.includes('password_hash')) {
      console.log('Adding "password_hash" column to platform_admins...');
      await client.query('ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS password_hash TEXT');
    }

    if (!existingCols.includes('name')) {
      console.log('Adding "name" column to platform_admins...');
      await client.query('ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS name TEXT DEFAULT \'Platform Administrator\'');
    }

    // Drop the foreign key to auth.users if present, so Express backend can create admin accounts directly
    try {
      await client.query('ALTER TABLE platform_admins DROP CONSTRAINT IF EXISTS platform_admins_user_id_fkey');
      console.log('✅ Dropped auth.users foreign key constraint');
    } catch (e) {
      console.log('FK drop note:', e.message);
    }

    // Drop the primary key on user_id if needed, and make id the primary key
    try {
      await client.query('ALTER TABLE platform_admins DROP CONSTRAINT IF EXISTS platform_admins_pkey');
      await client.query('ALTER TABLE platform_admins ALTER COLUMN user_id DROP NOT NULL');
      await client.query('ALTER TABLE platform_admins ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (id)');
      console.log('✅ Updated primary key to (id)');
    } catch (e) {
      console.log('PK update note:', e.message);
    }

    // Ensure email is unique
    try {
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_admins_email_unique ON platform_admins (email)');
    } catch (e) {
      console.log('Unique index note:', e.message);
    }

    // 2. Define Super Admin accounts to create / update
    const admins = [
      {
        email: 'admin@kushinapos.com',
        password: 'AdminPassword@2024',
        name: 'Super Admin'
      },
      {
        email: 'tsaron880@gmail.com',
        password: 'AdminPassword@2024',
        name: 'Tsaron Super Admin'
      }
    ];

    for (const admin of admins) {
      const hash = await bcrypt.hash(admin.password, 10);

      // Check if this admin exists
      const existing = await client.query('SELECT * FROM platform_admins WHERE email = $1', [admin.email.toLowerCase()]);

      if (existing.rows.length > 0) {
        // Update password hash and name
        await client.query(
          'UPDATE platform_admins SET password_hash = $1, name = $2, id = COALESCE(id, gen_random_uuid()) WHERE email = $3',
          [hash, admin.name, admin.email.toLowerCase()]
        );
        console.log(`✅ Updated Super Admin credentials for: ${admin.email}`);
      } else {
        // Insert new admin with both id and user_id populated
        await client.query(
          `INSERT INTO platform_admins (id, user_id, email, password_hash, name, created_at)
           VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, $3, NOW())`,
          [admin.email.toLowerCase(), hash, admin.name]
        );
        console.log(`✅ Created Super Admin account: ${admin.email}`);
      }
    }

    // Verify all platform_admins
    const allAdmins = await client.query('SELECT id, email, name, created_at FROM platform_admins');
    console.log('\n--- Current Super Admins in Database ---');
    console.table(allAdmins.rows);

  } catch (err) {
    console.error('❌ Error creating super admin:', err.message);
  } finally {
    await client.end();
  }
}

createSuperAdmin();
