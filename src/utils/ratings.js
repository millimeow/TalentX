const prisma = require('./prisma');

const SCORE_FIELDS = ['professionalism', 'punctuality', 'quality', 'communication', 'equipmentCare'];

// Average of every score field across the given ratings, 1 decimal place.
function averageOfRatings(ratings) {
  let total = 0;
  let count = 0;
  for (const rating of ratings) {
    for (const field of SCORE_FIELDS) {
      if (rating[field] !== null && rating[field] !== undefined) {
        total += rating[field];
        count++;
      }
    }
  }
  return count === 0 ? null : Math.round((total / count) * 10) / 10;
}

async function getAverageRating(userId) {
  const ratings = await prisma.rating.findMany({ where: { toUserId: userId } });
  return averageOfRatings(ratings);
}

// One query for many users (used by the gig board for "minimum rating of the giver").
async function getAveragesForUsers(userIds) {
  if (userIds.length === 0) return {};
  const ratings = await prisma.rating.findMany({
    where: { toUserId: { in: userIds } },
    select: { toUserId: true, professionalism: true, punctuality: true, quality: true, communication: true, equipmentCare: true },
  });
  const byUser = {};
  for (const userId of userIds) byUser[userId] = [];
  for (const rating of ratings) {
    if (byUser[rating.toUserId]) byUser[rating.toUserId].push(rating);
  }
  const averages = {};
  for (const userId of userIds) averages[userId] = averageOfRatings(byUser[userId]);
  return averages;
}

module.exports = { averageOfRatings, getAverageRating, getAveragesForUsers };
