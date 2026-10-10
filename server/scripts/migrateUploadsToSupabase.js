const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const db = require('../config/db');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase keys in env');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const baseUploads = path.join(__dirname, '../uploads');
  const folders = ['logos', 'menu-images'];
  
  for (const folder of folders) {
    const dir = path.join(baseUploads, folder);
    let files = [];
    try {
      files = await fs.readdir(dir);
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      throw err;
    }
    
    for (const file of files) {
      if (file.startsWith('.')) continue;
      const fullPath = path.join(dir, file);
      const buffer = await fs.readFile(fullPath);
      
      const filePath = `${folder}/${file}`;
      const ext = path.extname(file).toLowerCase();
      let mime = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.png') mime = 'image/png';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.pdf') mime = 'application/pdf';
      
      console.log(`Uploading ${filePath}...`);
      const { error } = await supabase.storage.from('public-assets').upload(filePath, buffer, { contentType: mime, upsert: true });
      if (error) {
        console.error(`Failed to upload ${filePath}:`, error);
        continue;
      }
      
      const { data: publicData } = supabase.storage.from('public-assets').getPublicUrl(filePath);
      const newUrl = publicData.publicUrl;
      const oldUrl = `/uploads/${folder}/${file}`;
      
      if (folder === 'logos') {
        await db.query('UPDATE restaurants SET logo_url = $1 WHERE logo_url = $2', [newUrl, oldUrl]);
      } else if (folder === 'menu-images') {
        await db.query('UPDATE menu_items SET image_url = $1 WHERE image_url = $2', [newUrl, oldUrl]);
      }
    }
  }
  
  // Migrate private docs (payment proofs, licenses)
  const basePrivateUploads = path.join(__dirname, '../private-uploads');
  const privateFolders = ['payment-proofs', 'licenses'];
  
  for (const folder of privateFolders) {
    const dir = path.join(basePrivateUploads, folder);
    let files = [];
    try {
      files = await fs.readdir(dir);
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      throw err;
    }
    
    for (const file of files) {
      if (file.startsWith('.')) continue;
      const fullPath = path.join(dir, file);
      const buffer = await fs.readFile(fullPath);
      
      const filePath = `${folder}/${file}`;
      const ext = path.extname(file).toLowerCase();
      let mime = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.png') mime = 'image/png';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.pdf') mime = 'application/pdf';
      
      console.log(`Uploading private ${filePath}...`);
      const { error } = await supabase.storage.from('private-docs').upload(filePath, buffer, { contentType: mime, upsert: true });
      if (error) {
        console.error(`Failed to upload private ${filePath}:`, error);
        continue;
      }
      // URLs for private docs don't need DB update since they remain /api/private-uploads/...
    }
  }
  
  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
