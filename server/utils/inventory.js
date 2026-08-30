const db = require('../config/db');

/**
 * Checks if any inventory items have dropped to 0 or below,
 * and if so, auto-86 (mark as unavailable) any menu items that depend on them.
 * @param {object} client - Postgres client (can be a transaction client)
 * @param {string} restaurantId 
 */
async function triggerAuto86(client, restaurantId) {
  // Find all menu items that depend on inventory items with quantity <= 0
  const { rows: affectedMenuIds } = await client.query(
    `SELECT DISTINCT mii.menu_item_id
     FROM menu_item_ingredients mii
     JOIN inventory_items ii ON ii.id = mii.inventory_item_id
     WHERE ii.restaurant_id = $1 AND ii.quantity <= 0`,
    [restaurantId]
  );

  if (affectedMenuIds.length > 0) {
    const ids = affectedMenuIds.map(r => r.menu_item_id);
    await client.query(
      `UPDATE menu_items 
       SET is_available = FALSE, updated_at = NOW() 
       WHERE id = ANY($1) AND is_available = TRUE`,
      [ids]
    );
  }
}

module.exports = {
  triggerAuto86
};
