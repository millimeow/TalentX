const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AppError = require('./AppError');

const ACCESS_TOKEN_LIFE = '1h';
const REFRESH_TOKEN_LIFE = '7d';

// Fail loudly and clearly when secrets are missing (e.g. on a fresh deployment)
function requireSecret(name) {
  const secret = process.env[name];
  if (!secret) {
    const err = new AppError(
      `Server misconfigured: ${name} is not set. Add it to the environment (locally in .env, on Vercel in Project Settings → Environment Variables) and redeploy.`,
      500
    );
    err.isConfigError = true;
    throw err;
  }
  return secret;
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    requireSecret('JWT_ACCESS_SECRET'),
    { expiresIn: ACCESS_TOKEN_LIFE }
  );
}

// jti (random id) keeps refresh tokens unique even when a user logs in
// twice within the same second (iat alone would collide on the DB unique key).
function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh', jti: crypto.randomBytes(12).toString('hex') },
    requireSecret('JWT_REFRESH_SECRET'),
    { expiresIn: REFRESH_TOKEN_LIFE }
  );
}

// Returns { id } or throws
function verifyAccessToken(token) {
  return jwt.verify(token, requireSecret('JWT_ACCESS_SECRET'));
}

function verifyRefreshToken(token) {
  return jwt.verify(token, requireSecret('JWT_REFRESH_SECRET'));
}

function refreshExpiryDate() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshExpiryDate,
};
