const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function seedKerodData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const restRes = await client.query("SELECT id FROM restaurants WHERE email = 'ephremsahle7@icloud.com'");
    if (restRes.rows.length === 0) return;
    const restId = restRes.rows[0].id;

    // 1. Check & Seed Tables if empty
    const tablesCheck = await client.query('SELECT COUNT(*) FROM tables WHERE restaurant_id = $1', [restId]);
    if (parseInt(tablesCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial tables for Kerod...');
      const tables = [
        { label: 'Table 1', capacity: 4, position_x: 50, position_y: 50 },
        { label: 'Table 2', capacity: 4, position_x: 180, position_y: 50 },
        { label: 'Table 3', capacity: 6, position_x: 310, position_y: 50 },
        { label: 'VIP Lounge', capacity: 8, position_x: 460, position_y: 50 },
        { label: 'Patio 1', capacity: 2, position_x: 50, position_y: 180 },
        { label: 'Patio 2', capacity: 2, position_x: 180, position_y: 180 },
      ];
      for (const t of tables) {
        await client.query(
          'INSERT INTO tables (id, restaurant_id, label, capacity, position_x, position_y, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, \'available\')',
          [restId, t.label, t.capacity, t.position_x, t.position_y]
        );
      }
    }

    // 2. Check & Seed Categories if empty
    const catCheck = await client.query('SELECT COUNT(*) FROM menu_categories WHERE restaurant_id = $1', [restId]);
    if (parseInt(catCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial menu categories for Kerod...');
      const cats = [
        { name: 'Traditional Stews & Mains', sort: 1 },
        { name: 'Sizzling Tibs & Grills', sort: 2 },
        { name: 'Hot & Cold Beverages', sort: 3 },
      ];
      for (const c of cats) {
        const catRes = await client.query(
          'INSERT INTO menu_categories (id, restaurant_id, name, sort_order, is_visible) VALUES (gen_random_uuid(), $1, $2, $3, true) RETURNING id',
          [restId, c.name, c.sort]
        );
        const catId = catRes.rows[0].id;

        if (c.name.includes('Traditional')) {
          await client.query(
            `INSERT INTO menu_items (id, restaurant_id, category_id, name, price, is_available) VALUES
             (gen_random_uuid(), $1, $2, 'Doro Wat Special', 650.00, true),
             (gen_random_uuid(), $1, $2, 'Special Kitfo', 580.00, true),
             (gen_random_uuid(), $1, $2, 'Traditional Bayenetu', 420.00, true)`,
            [restId, catId]
          );
        } else if (c.name.includes('Tibs')) {
          await client.query(
            `INSERT INTO menu_items (id, restaurant_id, category_id, name, price, is_available) VALUES
             (gen_random_uuid(), $1, $2, 'Special Shekla Tibs', 550.00, true),
             (gen_random_uuid(), $1, $2, 'Dereq Tibs (Crispy)', 520.00, true)`,
            [restId, catId]
          );
        } else if (c.name.includes('Beverages')) {
          await client.query(
            `INSERT INTO menu_items (id, restaurant_id, category_id, name, price, is_available) VALUES
             (gen_random_uuid(), $1, $2, 'Special Roasted Macchiato', 80.00, true),
             (gen_random_uuid(), $1, $2, 'Clay Pot Jebena Coffee', 120.00, true)`,
            [restId, catId]
          );
        }
      }
    }

    console.log('✅ Kerod restaurant tables and menu verified!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

seedKerodData();
