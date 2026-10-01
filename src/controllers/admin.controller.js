const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { averageOfRatings } = require('../utils/ratings');

// GET /admin/flagged — users whose average rating is under 2.0 after 5+ ratings,
// plus suspended accounts.
const listFlagged = asyncHandler(async (req, res) => {
  const ratings = await prisma.rating.findMany({
    select: { toUserId: true, professionalism: true, punctuality: true, quality: true, communication: true, equipmentCare: true },
  });

  const byUser = {};
  for (const rating of ratings) {
    if (!byUser[rating.toUserId]) byUser[rating.toUserId] = [];
    byUser[rating.toUserId].push(rating);
  }

  const flaggedUserIds = Object.entries(byUser)
    .filter(([userId, userRatings]) => userRatings.length >= 5 && averageOfRatings(userRatings) < 2.0)
    .map(([userId]) => Number(userId));

  const flagged = await prisma.user.findMany({
    where: { id: { in: flaggedUserIds } },
    select: { id: true, name: true, email: true, isSuspended: true, plan: true, createdAt: true },
  });
  const flaggedWithStats = flagged.map((user) => ({
    ...user,
    ratingsCount: byUser[user.id].length,
    averageRating: averageOfRatings(byUser[user.id]),
  }));

  const suspended = await prisma.user.findMany({
    where: { isSuspended: true },
    select: { id: true, name: true, email: true, plan: true, createdAt: true },
  });

  res.status(200).json({ flagged: flaggedWithStats, suspended });
});

// POST /admin/users/:id/suspend  body: { suspend: true|false }
const suspendUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const suspend = req.body.suspend !== false; // default true

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('User not found.', 404);
  if (user.role === 'ADMIN') {
    throw new AppError('Admins cannot be suspended.', 403);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isSuspended: suspend },
    select: { id: true, name: true, email: true, isSuspended: true },
  });

  res.status(200).json({ user: updated, message: suspend ? 'User suspended.' : 'User unsuspended.' });
});

module.exports = { listFlagged, suspendUser };
