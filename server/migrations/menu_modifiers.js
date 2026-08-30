require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const sql = `
  -- Tags column on menu_items
  ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

  -- Modifier groups (e.g. "Size", "Spice Level", "Add-ons")
  CREATE TABLE IF NOT EXISTS menu_modifiers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id  UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    is_required   BOOLEAN NOT NULL DEFAULT false,
    min_select    INT NOT NULL DEFAULT 0,
    max_select    INT NOT NULL DEFAULT 1,
    sort_order    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
  );

  -- Individual options inside a modifier group
  CREATE TABLE IF NOT EXISTS menu_modifier_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_id UUID NOT NULL REFERENCES menu_modifiers(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    price_delta NUMERIC(10,2) NOT NULL DEFAULT 0,
    sort_order  INT NOT NULL DEFAULT 0
  );
`;

pool.query(sql)
  .then(() => { console.log('Menu migration done'); pool.end(); })
  .catch(e => { console.error('Error:', e.message); pool.end(); process.exit(1); });
