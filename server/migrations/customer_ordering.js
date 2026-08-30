require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const sql = `
  -- Public restaurant URL slug & online ordering toggle
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug TEXT;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS online_ordering_enabled BOOLEAN DEFAULT TRUE;

  -- Add unique constraint on slug if not present
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_slug_key'
    ) THEN
      ALTER TABLE restaurants ADD CONSTRAINT restaurants_slug_key UNIQUE (slug);
    END IF;
  END $$;

  -- Populate slug for existing restaurants if null
  UPDATE restaurants 
  SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(id::text FROM 1 FOR 6)
  WHERE slug IS NULL;

  -- Order source & customer ordering fields
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source TEXT DEFAULT 'staff';
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time TIMESTAMPTZ;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'pay_at_checkout';
`;

pool.query(sql)
  .then(() => {
    console.log('✅ Customer ordering migration complete');
    pool.end();
  })
  .catch((e) => {
    console.error('❌ Migration failed:', e.message);
    pool.end();
    process.exit(1);
  });
