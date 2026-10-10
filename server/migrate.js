require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./config/db');

async function migrate() {
  try {
    console.log('🚀 Starting Database Migrations...');
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found. Skipping.');
      return;
    }

    // Create schema_migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Get applied migrations
    const { rows } = await db.query('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(rows.map(r => r.version));

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    let appliedCount = 0;
    
    for (const file of files) {
      if (appliedVersions.has(file)) {
        continue;
      }
      
      console.log(`\n⏳ Executing ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Execute the migration and record it in a transaction
      await db.query('BEGIN');
      try {
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await db.query('COMMIT');
        console.log(`✅ Applied ${file} successfully.`);
        appliedCount++;
      } catch (err) {
        await db.query('ROLLBACK');
        throw err;
      }
    }
    
    if (appliedCount === 0) {
      console.log('\n✅ Database is up to date. No new migrations to apply.');
    } else {
      console.log(`\n🎉 Applied ${appliedCount} migration(s) successfully.`);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();
