const AppError = require('../utils/AppError');
const prisma = require('../utils/prisma');

// Factory used on POST /gigs and POST /gigs/:id/apply.
// Free plan users get 3 gig posts and 3 applications per calendar month.
const FREE_LIMIT = 3;

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function checkPlanLimit(resource) {
  return async (req, res, next) => {
    if (req.user.plan === 'PRO') return next();

    const since = startOfMonth();
    let count = 0;

    if (resource === 'gig') {
      count = await prisma.gig.count({
        where: { giverId: req.user.id, createdAt: { gte: since } },
      });
    } else if (resource === 'application') {
      count = await prisma.application.count({
        where: { applicantId: req.user.id, createdAt: { gte: since } },
      });
    }

    if (count >= FREE_LIMIT) {
      return next(
        new AppError(
          `Free plan allows ${FREE_LIMIT} ${resource}s per month. Upgrade to PRO for unlimited.`,
          403
        )
      );
    }

    next();
  };
}

module.exports = checkPlanLimit;
