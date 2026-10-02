const path = require('path');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { getAverageRating } = require('../utils/ratings');
const { saveUpload } = require('../utils/storage');

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// GET /profile/me
const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
  res.status(200).json({ user: safeUser(req.user), profile });
});

// PUT /profile/me
const updateMyProfile = asyncHandler(async (req, res) => {
  const allowed = ['discipline', 'city', 'bio', 'dayRate', 'credits', 'gearList'];
  const data = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  if (data.dayRate !== undefined && data.dayRate !== null && (!Number.isInteger(data.dayRate) || data.dayRate < 0)) {
    throw new AppError('Day rate must be a positive number.', 400);
  }

  const profile = await prisma.profile.upsert({
    where: { userId: req.user.id },
    update: data,
    create: { userId: req.user.id, ...data },
  });

  res.status(200).json({ profile });
});

// POST /profile/me/photo (multipart: photo)
const uploadMyPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please choose an image to upload.', 400);
  }
  const photoPath = await saveUpload(req.file, 'photos');
  const profile = await prisma.profile.upsert({
    where: { userId: req.user.id },
    update: { photoPath },
    create: { userId: req.user.id, photoPath },
  });
  res.status(200).json({ profile, photoPath });
});

// GET /users/:id — public profile with average rating
const getPublicUser = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) throw new AppError('Invalid user id.', 400);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user) throw new AppError('User not found.', 404);

  const averageRating = await getAverageRating(userId);
  const ratingsCount = await prisma.rating.count({ where: { toUserId: userId } });

  res.status(200).json({
    user: { id: user.id, name: user.name, plan: user.plan, createdAt: user.createdAt },
    profile: user.profile,
    averageRating,
    ratingsCount,
  });
});

module.exports = { getMyProfile, updateMyProfile, uploadMyPhoto, getPublicUser };
