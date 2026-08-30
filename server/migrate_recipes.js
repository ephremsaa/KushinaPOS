require('dotenv').config();
const db = require('./config/db');

async function migrate() {
  try {
    console.log('Starting migration...');

    // Create menu_item_ingredients table
    await db.query(`
      CREATE TABLE IF NOT EXISTS menu_item_ingredients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        quantity_required NUMERIC(10,3) NOT NULL CHECK (quantity_required > 0),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(menu_item_id, inventory_item_id)
      );
    `);

    console.log('Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
