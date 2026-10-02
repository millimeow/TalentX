// Storage abstraction for uploaded files.
//
// - If BLOB_READ_WRITE_TOKEN is set (Vercel Blob), files go to blob storage and
//   we store the full URL — this is what makes uploads persist on serverless.
// - Otherwise (local dev, Render with a disk) files are written under
//   UPLOADS_DIR and we store a relative path served by /uploads/*.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { UPLOADS_DIR } = require('../middleware/uploadImage');

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

function safeName(originalname) {
  const ext = path.extname(originalname || '').toLowerCase();
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
}

// file: a multer file (buffer or path). folder: 'photos' | 'contracts' | 'deliverables'
async function saveUpload(file, folder) {
  if (useBlob()) {
    const { put } = require('@vercel/blob');
    const pathname = `${folder}/${safeName(file.originalname)}`;
    const body = file.buffer ? Buffer.from(file.buffer) : fs.readFileSync(file.path);
    const blob = await put(pathname, body, {
      access: 'public',
      contentType: file.mimetype || 'application/octet-stream',
      addRandomSuffix: true,
    });
    // Delete the /tmp copy multer made (serverless disk is ephemeral anyway)
    if (file.path) fs.unlink(file.path, () => {});
    return blob.url;
  }

  // Disk fallback
  const dir = path.join(UPLOADS_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  const filename = safeName(file.originalname);
  const target = path.join(dir, filename);
  if (file.buffer) fs.writeFileSync(target, file.buffer);
  else if (file.path && file.path !== target) fs.copyFileSync(file.path, target);
  if (file.path && file.path !== target && file.path.startsWith('/tmp')) fs.unlink(file.path, () => {});
  return `${folder}/${filename}`;
}

// Frontend-friendly URL for a stored path (full URL for blob, /uploads/* for disk)
function fileUrl(storedPath) {
  if (!storedPath) return null;
  if (/^https?:\/\//.test(storedPath)) return storedPath;
  return `/uploads/${storedPath}`;
}

module.exports = { saveUpload, fileUrl, useBlob };
