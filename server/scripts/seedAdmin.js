const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function seedAdmin() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const email = 'admin@kushinapos.com';
    const name = 'Super Admin';

    const { rowCount } = await pool.query(
      `INSERT INTO platform_admins (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [email, passwordHash, name]
    );

    if (rowCount > 0) {
      console.log('✅ Created default platform admin');
    } else {
      console.log('ℹ️ Default platform admin already exists');
    }
  } catch (err) {
    console.error('❌ Error creating admin:', err.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();
