const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function syncColumns() {
  const isSupabase = process.env.DATABASE_URL?.includes('supabase.com');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const restaurantColumns = [
      { name: 'name', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'city', type: 'TEXT' },
      { name: 'cuisine_type', type: 'TEXT' },
      { name: 'currency', type: "TEXT DEFAULT 'ETB'" },
      { name: 'theme_color', type: "TEXT DEFAULT '#2F7D32'" },
      { name: 'background_color', type: "TEXT DEFAULT '#F7F7F2'" },
      { name: 'tax_rate', type: 'NUMERIC(5,2) DEFAULT 0' },
      { name: 'tax_inclusive', type: 'BOOLEAN DEFAULT false' },
      { name: 'extra_tax_rates', type: "JSONB DEFAULT '[]'" },
      { name: 'service_charge_enabled', type: 'BOOLEAN DEFAULT false' },
      { name: 'service_charge_percent', type: 'NUMERIC(5,2) DEFAULT 10' },
      { name: 'service_charge_mandatory', type: 'BOOLEAN DEFAULT false' },
      { name: 'service_charge_split_staff', type: 'BOOLEAN DEFAULT false' },
      { name: 'receipt_footer', type: 'TEXT' },
      { name: 'receipt_header', type: 'TEXT' },
      { name: 'receipt_show_logo', type: 'BOOLEAN DEFAULT true' },
      { name: 'receipt_show_tax_breakdown', type: 'BOOLEAN DEFAULT true' },
      { name: 'receipt_default_mode', type: "TEXT DEFAULT 'print'" },
      { name: 'operating_hours', type: "JSONB DEFAULT '{}'" },
      { name: 'printers', type: "JSONB DEFAULT '[]'" },
      { name: 'kds_stations_config', type: "JSONB DEFAULT '[]'" },
      { name: 'slug', type: 'TEXT' },
      { name: 'online_ordering_enabled', type: 'BOOLEAN DEFAULT true' },
      { name: 'logo_url', type: 'TEXT' },
      { name: 'business_license_url', type: 'TEXT' },
      { name: 'tax_id', type: 'TEXT' },
    ];

    for (const col of restaurantColumns) {
      try {
        await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        console.log(`✓ restaurants.${col.name} verified`);
      } catch (err) {
        console.error(`Error adding column ${col.name}:`, err.message);
      }
    }

    const menuItemColumns = [
      { name: 'description', type: 'TEXT' },
      { name: 'tags', type: "TEXT[] DEFAULT '{}'" },
      { name: 'station', type: "TEXT DEFAULT 'General'" },
      { name: 'cost_price', type: "NUMERIC(10,2) DEFAULT 0" },
      { name: 'preparation_time_minutes', type: "INT DEFAULT 10" },
      { name: 'sort_order', type: "INT DEFAULT 0" },
      { name: 'image_url', type: "TEXT" },
      { name: 'is_available', type: "BOOLEAN DEFAULT true" },
    ];

    for (const col of menuItemColumns) {
      try {
        await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        console.log(`✓ menu_items.${col.name} verified`);
      } catch (err) {
        console.error(`Error adding menu_items column ${col.name}:`, err.message);
      }
    }

    // Customers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        points INT DEFAULT 0,
        stamps INT DEFAULT 0,
        tier TEXT DEFAULT 'Bronze',
        total_spent NUMERIC(10,2) DEFAULT 0,
        total_visits INT DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(restaurant_id, phone);
    `);
    console.log('✓ customers table verified');

    console.log('\n🎉 All schema columns synchronized successfully!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await client.end();
  }
}

syncColumns();
