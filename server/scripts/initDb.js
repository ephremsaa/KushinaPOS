/**
 * kushinaPOS — DB Initializer
 * Run: node server/scripts/initDb.js
 *
 * Creates the database (if needed) and runs schema.sql
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function init() {
  const url = new URL(process.env.DATABASE_URL);
  const dbName = url.pathname.slice(1);

  // Connect to postgres (default db) to create the target db if needed
  const adminUrl = `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres`;
  const admin = new Client({ connectionString: adminUrl });

  try {
    await admin.connect();
    const { rows } = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname=$1",
      [dbName]
    );
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Created database: ${dbName}`);
    } else {
      console.log(`ℹ️  Database already exists: ${dbName}`);
    }
  } catch (err) {
    console.error('❌ Failed to create database:', err.message);
    console.error('   Make sure PostgreSQL is running and credentials in .env are correct');
    process.exit(1);
  } finally {
    await admin.end();
  }

  // Now connect to the target db and run schema
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await db.connect();
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    await db.query(schema);
    console.log('✅ Schema applied successfully');
    console.log('\n🎉 Database ready! You can now start the server with: npm run dev\n');
  } catch (err) {
    console.error('❌ Schema error:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

init();
