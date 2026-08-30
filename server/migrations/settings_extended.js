require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const sql = `
  -- Operating hours per day stored as JSONB
  -- e.g. { "monday": { "open": "08:00", "close": "22:00", "closed": false }, ... }
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}';

  -- Tax configuration extensions
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT FALSE;
  -- Extra tax rates: [{id,name,rate}] — used for alcohol, VAT splits, etc.
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS extra_tax_rates JSONB DEFAULT '[]';

  -- Service charge / gratuity configuration
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_charge_enabled BOOLEAN DEFAULT FALSE;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_charge_percent NUMERIC(5,2) DEFAULT 0;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_charge_mandatory BOOLEAN DEFAULT FALSE;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_charge_split_staff BOOLEAN DEFAULT FALSE;

  -- Receipt customization
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_show_logo BOOLEAN DEFAULT TRUE;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_show_tax_breakdown BOOLEAN DEFAULT TRUE;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_header TEXT;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_default_mode TEXT DEFAULT 'print';

  -- Printers: [{id,name,station,type:"receipt"|"kitchen",ip_or_usb,is_active}]
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printers JSONB DEFAULT '[]';

  -- KDS station assignments: [{id,name,label,menu_stations:[]}]
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kds_stations_config JSONB DEFAULT '[]';

  -- Background color (was missing from original schema but used in app)
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#f1f5f9';

  -- Currency code
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ETB';
`;

pool.query(sql)
  .then(() => {
    console.log('✅ Settings extended migration complete');
    pool.end();
  })
  .catch((e) => {
    console.error('❌ Migration failed:', e.message);
    pool.end();
    process.exit(1);
  });
