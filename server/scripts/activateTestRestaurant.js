const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function activate() {
  try {
    const restRes = await db.query("SELECT * FROM restaurants WHERE slug = 'test-restaurant'");
    if (restRes.rows.length === 0) {
      console.log('No test-restaurant found.');
      return;
    }
    const rest = restRes.rows[0];
    const trialEnd = new Date(Date.now() + 14 * 86400000);

    // 1. Activate restaurant
    await db.query(
      "UPDATE restaurants SET status = 'active', approved_at = NOW(), trial_ends_at = $1 WHERE id = $2",
      [trialEnd, rest.id]
    );

    // 2. Ensure trial subscription
    const plan = await db.query("SELECT id FROM subscription_plans WHERE is_active = true ORDER BY price_monthly ASC LIMIT 1");
    if (plan.rows[0]) {
      const existingSub = await db.query("SELECT id FROM subscriptions WHERE restaurant_id = $1", [rest.id]);
      if (existingSub.rows.length === 0) {
        await db.query(
          `INSERT INTO subscriptions (restaurant_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
           VALUES ($1, $2, 'trial', 'monthly', NOW(), $3)`,
          [rest.id, plan.rows[0].id, trialEnd]
        );
      } else {
        await db.query(
          "UPDATE subscriptions SET status = 'trial', plan_id = $1, current_period_end = $2 WHERE id = $3",
          [plan.rows[0].id, trialEnd, existingSub.rows[0].id]
        );
      }
    }

    // 3. Create or update a manager staff member with PIN 1234
    const pinHash = await bcrypt.hash('1234', 10);
    const existingStaff = await db.query("SELECT id FROM staff WHERE restaurant_id = $1 AND role = 'manager'", [rest.id]);
    if (existingStaff.rows.length === 0) {
      await db.query(
        `INSERT INTO staff (restaurant_id, name, full_name, email, role, pin_hash, is_active)
         VALUES ($1, 'Manager Demo', 'Manager Demo', 'manager@test.com', 'manager', $2, true)`,
        [rest.id, pinHash]
      );
      console.log('✅ Created demo manager staff with PIN 1234');
    } else {
      await db.query(
        "UPDATE staff SET pin_hash = $1, is_active = true WHERE id = $2",
        [pinHash, existingStaff.rows[0].id]
      );
      console.log('✅ Updated demo manager staff PIN to 1234');
    }

    console.log('✅ Test Restaurant successfully activated with 14-day trial!');
  } catch (err) {
    console.error('Error activating restaurant:', err);
  } finally {
    process.exit(0);
  }
}

activate();
