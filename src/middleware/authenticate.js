const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { verifyAccessToken } = require('../utils/tokens');

// Checks the Authorization: Bearer header, loads the user and attaches it to req.user.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new AppError('Authentication required. Please log in.', 401);
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw new AppError('Invalid or expired token. Please log in again.', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });

  if (!user) {
    throw new AppError('User no longer exists.', 401);
  }

  if (user.isSuspended) {
    throw new AppError('This account is suspended. Contact support.', 403);
  }

  req.user = user;
  next();
});

module.exports = authenticate;
