const db = require('../config/db');

async function getSafeTz(restaurantId) {
  const { rows } = await db.query('SELECT timezone FROM restaurants WHERE id=$1', [restaurantId]);
  let tz = rows[0]?.timezone || 'Africa/Addis_Ababa';
  const { rows: check } = await db.query('SELECT name FROM pg_timezone_names WHERE name=$1', [tz]);
  return check.length ? check[0].name : 'Africa/Addis_Ababa';
}

module.exports = { getSafeTz };
