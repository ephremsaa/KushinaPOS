const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;

const useLocal = process.env.NODE_ENV !== 'production' && process.env.STORAGE_DRIVER === 'local';

let supabase;
if (!useLocal) {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in production.');
      process.exit(1);
    } else {
      console.warn('WARNING: Supabase credentials missing. Uploads will fail unless STORAGE_DRIVER=local is set.');
    }
  } else {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
}

function getMimeAndExt(buffer) {
  if (buffer.length < 4) return null;
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { mime: 'image/png', ext: '.png' };
  }
  // WEBP
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  // PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { mime: 'application/pdf', ext: '.pdf' };
  }
  return null;
}

const memoryStorage = multer.memoryStorage();

function createUploadMiddleware({ fieldName, folder, maxBytes, isPrivate = false, allowPdf = false }) {
  const upload = multer({ 
    storage: memoryStorage, 
    limits: { fileSize: maxBytes } 
  });
  
  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return next();

      const fileInfo = getMimeAndExt(req.file.buffer);
      if (!fileInfo) {
        return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, WEBP allowed.' });
      }
      
      if (req.file.mimetype === 'image/svg+xml') {
        return res.status(400).json({ error: 'SVG is not allowed.' });
      }

      if (!allowPdf && fileInfo.mime === 'application/pdf') {
        return res.status(400).json({ error: 'PDF not allowed for this field.' });
      }

      const filename = `${crypto.randomUUID()}${fileInfo.ext}`;
      
      if (useLocal) {
        const baseDir = isPrivate 
          ? path.join(__dirname, '../../server/private-uploads', folder) 
          : path.join(__dirname, '../../server/uploads', folder);
        try {
          await fs.mkdir(baseDir, { recursive: true });
          const fullPath = path.join(baseDir, filename);
          await fs.writeFile(fullPath, req.file.buffer);
          
          req.file.url = isPrivate 
            ? `/api/private-uploads/${folder}/${filename}` 
            : `/uploads/${folder}/${filename}`;
          req.file.localPath = fullPath;
          return next();
        } catch (err) {
          console.error('File write error:', err);
          return res.status(500).json({ error: 'Failed to save file locally' });
        }
      } else {
        if (!supabase) return res.status(500).json({ error: 'Supabase storage not configured' });
        
        const bucket = isPrivate ? 'private-docs' : 'public-assets';
        const filePath = `${folder}/${filename}`;
        
        const { error } = await supabase.storage
          .from(bucket)
          .upload(filePath, req.file.buffer, { contentType: fileInfo.mime });
          
        if (error) {
          console.error('Supabase upload error:', error);
          return res.status(500).json({ error: 'Failed to upload file to storage' });
        }
        
        if (isPrivate) {
          req.file.url = `/api/private-uploads/${folder}/${filename}`;
        } else {
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          req.file.url = publicData.publicUrl;
        }
        return next();
      }
    });
  };
}

async function deleteOldUpload(url) {
  if (!url) return;
  try {
    if (useLocal) {
      let localPath = '';
      if (url.startsWith('/api/private-uploads/')) {
        localPath = path.join(__dirname, '../../server/private-uploads', url.replace('/api/private-uploads/', ''));
      } else if (url.startsWith('/uploads/')) {
        localPath = path.join(__dirname, '../../server/uploads', url.replace('/uploads/', ''));
      }
      if (localPath) await fs.unlink(localPath);
    } else {
      if (!supabase) return;
      if (url.startsWith('/api/private-uploads/')) {
        const filePath = url.replace('/api/private-uploads/', '');
        await supabase.storage.from('private-docs').remove([filePath]);
      } else if (url.startsWith('http')) {
        // Public url format: https://.../public-assets/<folder>/<filename>
        const matches = url.match(/public-assets\/(.+)$/);
        if (matches && matches[1]) {
          await supabase.storage.from('public-assets').remove([matches[1]]);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to delete old upload ${url}:`, err);
    }
  }
}

async function getPrivateSignedUrl(filePath) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.storage.from('private-docs').createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

module.exports = {
  createUploadMiddleware,
  deleteOldUpload,
  getPrivateSignedUrl,
  useLocal
};
