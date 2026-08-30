require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/db');

async function migrateSlugs() {
  try {
    console.log('Adding slug column to restaurants table if not exists...');
    await db.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;`);

    console.log('Backfilling slugs for existing restaurants...');
    const { rows } = await db.query('SELECT id, name FROM restaurants WHERE slug IS NULL');
    
    for (const rest of rows) {
      let baseSlug = rest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      if (!baseSlug) baseSlug = 'restaurant';
      
      let slug = baseSlug;
      let counter = 1;
      let isUnique = false;
      
      while (!isUnique) {
        const existing = await db.query('SELECT id FROM restaurants WHERE slug = $1 AND id != $2', [slug, rest.id]);
        if (existing.rows.length === 0) {
          isUnique = true;
        } else {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }
      
      await db.query('UPDATE restaurants SET slug = $1 WHERE id = $2', [slug, rest.id]);
      console.log(`Updated ${rest.name} -> slug: ${slug}`);
    }

    console.log('✅ Slug migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateSlugs();
