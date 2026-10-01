const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { signAccessToken, signRefreshToken, verifyRefreshToken, refreshExpiryDate } = require('../utils/tokens');

// The Google client id is public info — the frontend needs it to render the button.
const googleClientId = process.env.GOOGLE_CLIENT_ID || null;

// GET /auth/google-client-id
const getGoogleClientId = asyncHandler(async (req, res) => {
  res.status(200).json({ clientId: googleClientId });
});

// POST /auth/google  body: { credential } (the ID token from Google Identity Services)
// No extra npm package: the token is verified against Google's public tokeninfo endpoint.
const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    throw new AppError('Google credential is required.', 400);
  }
  if (!googleClientId) {
    throw new AppError('Google sign-in is not configured on this server (missing GOOGLE_CLIENT_ID).', 501);
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) {
    throw new AppError('Google sign-in failed: the token could not be verified.', 401);
  }
  const info = await response.json();

  if (info.aud !== googleClientId) {
    throw new AppError('Google sign-in failed: token was issued for a different app.', 401);
  }
  if (info.email_verified !== 'true' && info.email_verified !== true) {
    throw new AppError('Google sign-in failed: the email is not verified.', 401);
  }

  let user = await prisma.user.findUnique({ where: { email: info.email.toLowerCase() } });
  if (!user) {
    // Random password hash: this account can only be entered through Google
    // (or by setting a password later — not part of the MVP).
    const randomSecret = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomSecret, 10);
    user = await prisma.user.create({
      data: {
        name: info.name || info.email.split('@')[0],
        email: info.email.toLowerCase(),
        passwordHash,
        profile: { create: {} },
      },
    });
  }

  if (user.isSuspended) {
    throw new AppError('This account is suspended. Contact support.', 403);
  }

  const tokens = await issueTokens(user);
  res.status(200).json({ user: safeUser(user), ...tokens });
});

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiryDate() },
  });
  return { accessToken, refreshToken };
}

// POST /auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new AppError('Name, email and password are required.', 400);
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new AppError('Please enter a valid email address.', 400);
  }
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters.', 400);
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      profile: { create: {} },
    },
  });

  const tokens = await issueTokens(user);
  res.status(201).json({ user: safeUser(user), ...tokens });
});

// POST /auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required.', 400);
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    throw new AppError('Wrong email or password.', 401);
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    throw new AppError('Wrong email or password.', 401);
  }

  if (user.isSuspended) {
    throw new AppError('This account is suspended. Contact support.', 403);
  }

  const tokens = await issueTokens(user);
  res.status(200).json({ user: safeUser(user), ...tokens });
});

// POST /auth/refresh — old refresh token is deleted, a new pair is issued (rotation).
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new AppError('Refresh token is required.', 400);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token. Please log in again.', 401);
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored) {
    throw new AppError('Refresh token is no longer valid. Please log in again.', 401);
  }
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError('Refresh token expired. Please log in again.', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || user.isSuspended) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError('Account not available. Please log in again.', 401);
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const tokens = await issueTokens(user);
  res.status(200).json({ user: safeUser(user), ...tokens });
});

// POST /auth/logout
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  res.status(200).json({ message: 'Logged out.' });
});

module.exports = { register, login, refresh, logout, getGoogleClientId, googleLogin };
