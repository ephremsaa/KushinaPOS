const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase cloud requires SSL; rejectUnauthorized:false works with their certs
  ssl: process.env.DATABASE_URL?.includes('supabase.com')
    ? { rejectUnauthorized: false }
    : process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Check DATABASE_URL in server/.env');
    process.exit(1);
  }
  release();
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`✅ Connected to PostgreSQL (${url.pathname.slice(1)} on ${url.hostname})`);
  } catch {
    console.log('✅ Connected to PostgreSQL');
  }
});

module.exports = pool;
