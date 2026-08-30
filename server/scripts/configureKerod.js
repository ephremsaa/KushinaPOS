const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function configureKerodOwner() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to DB');

    const email = 'ephremsahle7@icloud.com';
    const password = 'Efo@sal1';
    const hash = await bcrypt.hash(password, 10);

    // 1. Remove ephremsahle7@icloud.com from platform_admins so they are solely a restaurant owner
    await client.query('DELETE FROM platform_admins WHERE email = $1', [email]);
    console.log('✅ Removed from platform_admins');

    // 2. Check if a subscription plan exists (Starter/Growth/Enterprise) to assign to kerod
    const plansRes = await client.query('SELECT id, name FROM subscription_plans ORDER BY price_monthly DESC LIMIT 1');
    const enterprisePlan = plansRes.rows[0];
    console.log('Assigning plan to kerod:', enterprisePlan);

    // 3. Update kerod restaurant in restaurants table
    const updateRes = await client.query(
      `UPDATE restaurants 
       SET name = 'kerod',
           email = $1,
           password_hash = $2,
           status = 'active',
           slug = COALESCE(slug, 'kerod'),
           currency = 'ETB',
           plan_id = $3,
           updated_at = NOW()
       WHERE email = $1 OR slug = 'kerod'
       RETURNING id, name, email, slug, status, plan_id`,
      [email, hash, enterprisePlan?.id || null]
    );

    console.log('Updated restaurant:', updateRes.rows);

    // 4. Ensure an active subscription exists for kerod so they don't get redirected to /subscribe or /pending
    if (updateRes.rows.length > 0) {
      const restId = updateRes.rows[0].id;
      const subExists = await client.query('SELECT * FROM subscriptions WHERE restaurant_id = $1', [restId]);
      if (subExists.rows.length === 0 && enterprisePlan) {
        await client.query(
          `INSERT INTO subscriptions (restaurant_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
           VALUES ($1, $2, 'active', 'monthly', NOW(), NOW() + INTERVAL '365 days')`,
          [restId, enterprisePlan.id]
        );
        console.log('✅ Created active subscription for kerod');
      } else if (subExists.rows.length > 0) {
        await client.query(
          `UPDATE subscriptions SET status = 'active', plan_id = $1 WHERE restaurant_id = $2`,
          [enterprisePlan?.id || null, restId]
        );
        console.log('✅ Updated subscription status to active for kerod');
      }
    }

    console.log('\n🎉 Kerod restaurant owner successfully configured!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

configureKerodOwner();
