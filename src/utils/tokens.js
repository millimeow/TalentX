const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_LIFE = '1h';
const REFRESH_TOKEN_LIFE = '7d';

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_LIFE }
  );
}

// jti (random id) keeps refresh tokens unique even when a user logs in
// twice within the same second (iat alone would collide on the DB unique key).
function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh', jti: crypto.randomBytes(12).toString('hex') },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_LIFE }
  );
}

// Returns { id } or throws
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
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
