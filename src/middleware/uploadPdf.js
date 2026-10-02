const multer = require('multer');

// Contract and rental-agreement PDFs. Memory storage; persistence is handled
// by src/utils/storage.js (Vercel Blob when configured, disk otherwise).
// uploads/contracts is NOT served statically — PDFs are only sent out through
// controller endpoints that check the requester is the giver, taker or an admin.
const uploadPdf = multer({
  storage: multer.memoryStorage(),
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
