import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

let found = false;

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!fullPath.includes(path.normalize('src/components/ui')) && !fullPath.includes(path.normalize('src\\components\\ui'))) {
        walk(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('bg-white')) {
        console.error(`Error: bg-white found in ${fullPath}. Use bg-surface instead.`);
        found = true;
      }
    }
  }
}

walk(srcDir);

if (found) {
  process.exit(1);
} else {
  console.log('No invalid bg-white usage found.');
}
