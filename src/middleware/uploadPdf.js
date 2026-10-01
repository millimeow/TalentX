const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('./uploadImage');

// Contract and rental-agreement PDFs go to uploads/contracts/.
// This folder is NOT served statically — PDFs are only sent out through
// controller endpoints that check the requester is the giver, taker or an admin.
const uploadPdf = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOADS_DIR, 'contracts');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const crypto = require('crypto');
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only PDF files are allowed.'), { statusCode: 400 }));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // PDFs up to 10 MB
});

module.exports = uploadPdf;
