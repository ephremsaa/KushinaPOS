const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function main() {
  const hash = await bcrypt.hash('password123', 10);
  await db.query(
    "UPDATE restaurants SET password_hash = $1, status = 'active', loyalty_enabled = true WHERE email = 'test@example.com'",
    [hash]
  );
  
  const rest = await db.query("SELECT id FROM restaurants WHERE email = 'test@example.com'");
  if (rest.rows[0]) {
    const plans = await db.query("SELECT id FROM subscription_plans WHERE name = 'Pro' OR name = 'Enterprise' LIMIT 1");
    if (plans.rows[0]) {
      await db.query("DELETE FROM subscriptions WHERE restaurant_id = $1", [rest.rows[0].id]);
      await db.query(
        "INSERT INTO subscriptions (restaurant_id, plan_id, status, current_period_end) VALUES ($1, $2, 'active', NOW() + interval '30 days')",
        [rest.rows[0].id, plans.rows[0].id]
      );
    }
    
    const pinHash = await bcrypt.hash('1234', 10);
    await db.query(`
      INSERT INTO staff (restaurant_id, name, full_name, email, role, pin_hash, is_active)
      VALUES ($1, 'Manager Abebe', 'Manager Abebe', 'manager_abebe@test.com', 'manager', $2, true)
      ON CONFLICT DO NOTHING
    `, [rest.rows[0].id, pinHash]);
  }

  console.log('Test restaurant test@example.com activated with password123 and Pro subscription!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
