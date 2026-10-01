const AppError = require('../utils/AppError');

// Central error handler — every error ends up here as JSON.
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong on the server.';

  // Multer upload errors (wrong type, file too big)
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File is too big.';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = `Upload error: ${err.message}`;
  }

  // Known Prisma errors
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'This record already exists (duplicate value).';
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found.';
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body.';
  }

  if (statusCode >= 500) {
    console.error('Unexpected error:', err);
    message = 'Something went wrong on the server.';
  }

  res.status(statusCode).json({ error: message, statusCode });
}

module.exports = errorHandler;
