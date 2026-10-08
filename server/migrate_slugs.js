const db = require('./config/db');
async function run() {
  await db.query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS previous_slugs JSONB DEFAULT '[]'::jsonb;");
  console.log("added");
  process.exit(0);
}
run();
