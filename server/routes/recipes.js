const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant, requireManager } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireTenant);

const tid = (req) => req.user.restaurantId;

// ── GET /api/recipes/:menuItemId ─────────────────────────────────
router.get('/:menuItemId', requireManager, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT mii.id, mii.inventory_item_id, mii.quantity_required, ii.name as ingredient_name, ii.unit
       FROM menu_item_ingredients mii
       JOIN inventory_items ii ON ii.id = mii.inventory_item_id
       WHERE mii.menu_item_id = $1 AND mii.restaurant_id = $2
       ORDER BY ii.name`,
      [req.params.menuItemId, tid(req)]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// ── POST /api/recipes/:menuItemId ────────────────────────────────
router.post('/:menuItemId', requireManager, async (req, res) => {
  const { ingredients } = req.body; // [{ inventory_item_id, quantity_required }]
  if (!Array.isArray(ingredients)) return res.status(400).json({ error: 'ingredients array required' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Clear existing ingredients for this menu item
    await client.query(
      'DELETE FROM menu_item_ingredients WHERE menu_item_id = $1 AND restaurant_id = $2',
      [req.params.menuItemId, tid(req)]
    );

    // Insert new ingredients
    for (const ing of ingredients) {
      if (!ing.inventory_item_id || !ing.quantity_required) continue;
      await client.query(
        `INSERT INTO menu_item_ingredients (restaurant_id, menu_item_id, inventory_item_id, quantity_required)
         VALUES ($1, $2, $3, $4)`,
        [tid(req), req.params.menuItemId, ing.inventory_item_id, ing.quantity_required]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Recipe updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update recipe' });
  } finally {
    client.release();
  }
});

module.exports = router;
