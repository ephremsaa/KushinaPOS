const bcrypt = require('bcryptjs');
const db = require('../config/db');

/**
 * Verify a manager or owner PIN for a given restaurant
 * @param {string} restaurantId 
 * @param {string|number} pin 
 * @param {object} [client] - optional pg client if in transaction
 * @returns {Promise<{ authorized: boolean, staff: object | null }>}
 */
async function verifyManagerPin(restaurantId, pin, client = null) {
  if (!restaurantId || !pin) return { authorized: false, staff: null };
  const queryRunner = client || db;

  const { rows } = await queryRunner.query(
    `SELECT id, name, email, role, pin_hash FROM staff
     WHERE restaurant_id = $1 
       AND is_active = TRUE 
       AND role IN ('owner', 'manager') 
       AND pin_hash IS NOT NULL`,
    [restaurantId]
  );

  const cleanPin = String(pin).trim();
  for (const s of rows) {
    if (s.pin_hash) {
      const match = await bcrypt.compare(cleanPin, s.pin_hash);
      if (match) {
        return { authorized: true, staff: s };
      }
    }
  }

  return { authorized: false, staff: null };
}

/**
 * Enforce PIN uniqueness within a restaurant
 * Checks if any other active staff in the restaurant already uses the same PIN
 * @param {string} restaurantId 
 * @param {string|number} pin 
 * @param {string} [excludeStaffId] - staff id to ignore when updating existing staff
 * @param {object} [client]
 * @returns {Promise<boolean>} - true if PIN is unique, false if already in use
 */
async function isPinUniqueForRestaurant(restaurantId, pin, excludeStaffId = null, client = null) {
  if (!restaurantId || !pin) return true;
  const queryRunner = client || db;

  let query = `SELECT id, pin_hash FROM staff WHERE restaurant_id = $1 AND is_active = TRUE AND pin_hash IS NOT NULL`;
  const params = [restaurantId];

  if (excludeStaffId) {
    query += ` AND id != $2`;
    params.push(excludeStaffId);
  }

  const { rows } = await queryRunner.query(query, params);
  const cleanPin = String(pin).trim();

  for (const s of rows) {
    if (s.pin_hash) {
      const match = await bcrypt.compare(cleanPin, s.pin_hash);
      if (match) {
        return false; // Found matching PIN
      }
    }
  }

  return true;
}

module.exports = {
  verifyManagerPin,
  isPinUniqueForRestaurant,
};
