const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#f1f5f9'`);
    console.log('Successfully added background_color column to restaurants');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
