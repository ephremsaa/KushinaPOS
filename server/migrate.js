const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir);
    
    // Sort all .sql files
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    // Check if the DB is already populated (legacy) to conditionally skip 0001
    const { rows } = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurants')");
    const isLegacyDb = rows[0].exists;
    
    for (const file of files) {
      const { rows: migrated } = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [file]);
      if (migrated.length > 0) continue; // already applied
      
      // If it's legacy DB and file is 0001, mark as applied instead of running it to avoid conflicts.
      // 0001 contains the ENTIRE legacy schema and patches combined.
      if (isLegacyDb && file.startsWith('0001')) {
        console.log(`Skipping legacy migration on existing DB: ${file}`);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        continue;
      }
      
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Migration ${file} failed:`, err.message);
        process.exit(1);
      }
    }
    
    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('❌ Migration runner failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
