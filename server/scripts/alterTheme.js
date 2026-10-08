const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(`ALTER TABLE restaurants ALTER COLUMN theme_color SET DEFAULT '#2F7D32'`);
    await client.query(`ALTER TABLE restaurants ALTER COLUMN background_color SET DEFAULT '#F7F7F2'`);
    const res = await client.query(
      `UPDATE restaurants 
       SET theme_color = '#2F7D32', background_color = '#F7F7F2' 
       WHERE theme_color IS NULL OR theme_color = '#f97316' OR theme_color = ''`
    );
    console.log(`Successfully updated ${res.rowCount} restaurant(s) to Kushina Emerald (#2F7D32) and Cream (#F7F7F2)`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
