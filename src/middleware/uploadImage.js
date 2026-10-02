const multer = require('multer');

// Where disk-fallback files live. Serverless hosts (Vercel) have a read-only
// filesystem except /tmp; persistence there comes from Vercel Blob instead
// (see src/utils/storage.js). Set UPLOAD_DIR to override.
const UPLOADS_DIR = process.env.UPLOAD_DIR
  ? process.env.UPLOAD_DIR
  : process.env.VERCEL
    ? '/tmp/uploads'
    : require('path').join(__dirname, '..', '..', 'uploads');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function imageFilter(req, file, cb) {
  if (IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Only image files (jpg, png, webp, gif) are allowed.'), { statusCode: 400 }));
  }
}

// Memory storage: src/utils/storage.js decides where the file actually ends up
// (Vercel Blob when configured, disk otherwise).
function imageOptions() {
  return {
    storage: multer.memoryStorage(),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // images up to 5 MB
  };
}

// All photos (profile, portfolio, gear) go to the photos folder.
const uploadProfileImage = multer(imageOptions());
const uploadPortfolioImage = multer(imageOptions());
const uploadGearImage = multer(imageOptions());

// Deliverables get their own folder.
const uploadDeliverable = multer(imageOptions());

module.exports = { uploadProfileImage, uploadPortfolioImage, uploadGearImage, uploadDeliverable, UPLOADS_DIR };
