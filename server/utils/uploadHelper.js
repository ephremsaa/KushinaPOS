const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;

// Check magic bytes for JPEG, PNG, WEBP, PDF
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

/**
 * Creates an upload middleware that verifies magic bytes, saves to a designated folder,
 * and attaches `req.file.url` (and `req.file.localPath`) for the next handler.
 * 
 * @param {Object} options 
 * @param {string} options.fieldName - Name of the form field
 * @param {string} options.folder - Destination folder name (e.g., 'logos')
 * @param {number} options.maxBytes - Max file size in bytes
 * @param {boolean} options.isPrivate - Whether it goes to private-uploads
 * @param {boolean} options.allowPdf - Whether PDF is allowed
 */
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
      
      // Specifically reject SVG even if multer allowed it (though magic bytes check already rejects it)
      if (req.file.mimetype === 'image/svg+xml') {
        return res.status(400).json({ error: 'SVG is not allowed.' });
      }

      if (!allowPdf && fileInfo.mime === 'application/pdf') {
        return res.status(400).json({ error: 'PDF not allowed for this field.' });
      }

      const filename = `${crypto.randomUUID()}${fileInfo.ext}`;
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
        
        next();
      } catch (err) {
        console.error('File write error:', err);
        res.status(500).json({ error: 'Failed to save file' });
      }
    });
  };
}

/**
 * Deletes an old uploaded file if replaced.
 * @param {string} url - The URL string stored in DB
 */
async function deleteOldUpload(url) {
  if (!url) return;
  try {
    let localPath = '';
    if (url.startsWith('/api/private-uploads/')) {
      localPath = path.join(__dirname, '../../server/private-uploads', url.replace('/api/private-uploads/', ''));
    } else if (url.startsWith('/uploads/')) {
      localPath = path.join(__dirname, '../../server/uploads', url.replace('/uploads/', ''));
    }
    if (localPath) {
      await fs.unlink(localPath);
    }
  } catch (err) {
    // Ignore ENOENT (file already deleted or missing)
    if (err.code !== 'ENOENT') {
      console.error(`Failed to delete old upload ${url}:`, err);
    }
  }
}

module.exports = {
  createUploadMiddleware,
  deleteOldUpload,
};
