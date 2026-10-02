const AppError = require('../utils/AppError');

// Central error handler — every error ends up here as JSON.
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong on the server.';
  let diagnosed = false; // true when we recognised the root cause below

  // Deliberate configuration errors should say exactly what is missing —
  // they are the usual reason a fresh deployment returns 500s.
  if (err.isConfigError) {
    console.error('Config error:', err.message);
    return res.status(statusCode).json({ error: message, statusCode });
  }

  // Multer upload errors (wrong type, file too big)
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File is too big.';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = `Upload error: ${err.message}`;
  }

  // Read-only filesystem (Vercel/lambda) — uploads need persistent storage
  if (err.code === 'EROFS' || /EROFS|read-only file system/i.test(err.message || '')) {
    statusCode = 500;
    diagnosed = true;
    message = 'This host has a read-only filesystem, so uploaded files cannot be stored. Deploy to a host with a persistent disk (e.g. Render with a disk) for the upload flows.';
  }

  // Database not configured or unreachable (typical on a fresh Vercel deploy)
  if (
    /DATABASE_URL|PrismaClientInitializationError|Can't reach database server|P1001/i.test(
      `${err.message || ''} ${err.code || ''} ${err.name || ''}`
    )
  ) {
    statusCode = 500;
    diagnosed = true;
    message = 'Database not reachable: check that DATABASE_URL points to a hosted PostgreSQL database this deployment can reach (localhost will not work on Vercel).';
  }

  // Known Prisma request errors
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
    console.error('Server error:', err);
    if (!diagnosed) {
      message = 'Something went wrong on the server.';
    }
  }

  res.status(statusCode).json({ error: message, statusCode });
}

module.exports = errorHandler;
