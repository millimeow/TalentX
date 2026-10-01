const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Unique file name: timestamp + short random suffix + original extension,
// so two uploads never overwrite each other.
function uniqueName(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const random = crypto.randomBytes(4).toString('hex');
  return `${Date.now()}-${random}${ext}`;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function imageFilter(req, file, cb) {
  if (IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Only image files (jpg, png, webp, gif) are allowed.'), { statusCode: 400 }));
  }
}

function imageOptions(folder) {
  return {
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(UPLOADS_DIR, folder);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => cb(null, uniqueName(file)),
    }),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // images up to 5 MB
  };
}

// All photos (profile, portfolio, gear) go to uploads/photos/.
const uploadProfileImage = multer(imageOptions('photos'));
const uploadPortfolioImage = multer(imageOptions('photos'));
const uploadGearImage = multer(imageOptions('photos'));

// Deliverables get their own folder, served statically as well.
const uploadDeliverable = multer(imageOptions('deliverables'));

module.exports = { uploadProfileImage, uploadPortfolioImage, uploadGearImage, uploadDeliverable, UPLOADS_DIR };
