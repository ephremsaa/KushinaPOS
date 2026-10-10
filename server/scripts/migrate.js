require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function migrate() {
  try {
    console.log('🚀 Starting Database Migrations...');
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found. Skipping.');
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of files) {
      console.log(`\n⏳ Executing ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      await db.query(sql);
      console.log(`✅ Applied ${file} successfully.`);
    }
    
    console.log('\n🎉 All migrations applied successfully to the database.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();
