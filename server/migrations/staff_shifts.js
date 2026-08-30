require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const sql = `
  -- Add phone column to staff
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone TEXT;

  -- Store a hashed 4-digit manager PIN (separate from login password)
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin_hash TEXT;

  -- Soft-delete at field level (is_active already exists)
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS deactivation_note TEXT;

  -- Shift / clock-in-out table
  CREATE TABLE IF NOT EXISTS staff_shifts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    clocked_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clocked_out_at  TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );

  -- Index for fast lookups per staff member
  CREATE INDEX IF NOT EXISTS idx_shifts_staff ON staff_shifts(staff_id, clocked_in_at DESC);
`;

pool.query(sql)
  .then(() => { console.log('Staff migration done'); pool.end(); })
  .catch(e => { console.error('Error:', e.message); pool.end(); process.exit(1); });
