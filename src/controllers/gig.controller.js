const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { getAveragesForUsers } = require('../utils/ratings');

function validateGigInput(body) {
  const { title, description, discipline, city, shootDate, budget } = body;
  if (!title || !description || !discipline || !city || !shootDate || budget === undefined) {
    throw new AppError('Title, description, discipline, city, shoot date and budget are required.', 400);
  }
  if (!Number.isInteger(budget) || budget <= 0) {
    throw new AppError('Budget must be a positive whole number.', 400);
  }
  const date = new Date(shootDate);
  if (isNaN(date.getTime())) {
    throw new AppError('Shoot date is not a valid date.', 400);
  }
  let peopleNeeded = body.peopleNeeded === undefined ? 1 : Number(body.peopleNeeded);
  if (!Number.isInteger(peopleNeeded) || peopleNeeded < 1) {
    throw new AppError('Number of people needed must be at least 1.', 400);
  }
  return { title, description, discipline, city, shootDate: date, budget, peopleNeeded };
}

// POST /gigs
const createGig = asyncHandler(async (req, res) => {
  const data = validateGigInput(req.body);

  const gig = await prisma.gig.create({
    data: { ...data, giverId: req.user.id },
  });

  res.status(201).json({ gig });
});

// GET /gigs?discipline=&city=&minBudget=&maxBudget=&minGiverRating=&status=
const listGigs = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.discipline) where.discipline = { contains: req.query.discipline, mode: 'insensitive' };
  if (req.query.city) where.city = { contains: req.query.city, mode: 'insensitive' };
  if (req.query.status) where.status = req.query.status;
  if (req.query.minBudget || req.query.maxBudget) {
    where.budget = {};
    if (req.query.minBudget) where.budget.gte = Number(req.query.minBudget);
    if (req.query.maxBudget) where.budget.lte = Number(req.query.maxBudget);
  }

  let gigs = await prisma.gig.findMany({
    where,
    include: {
      giver: { select: { id: true, name: true, plan: true } },
      contract: { select: { id: true } },
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Average rating of each giver, for display and the minGiverRating filter.
  const giverIds = [...new Set(gigs.map((g) => g.giver.id))];
  const averages = await getAveragesForUsers(giverIds);

  let results = gigs.map((gig) => ({
    ...gig,
    giverRating: averages[gig.giver.id],
  }));

  if (req.query.minGiverRating) {
    const min = Number(req.query.minGiverRating);
    if (!isNaN(min)) {
      results = results.filter((g) => g.giverRating !== null && g.giverRating >= min);
    }
  }

  // PRO givers get priority in search, then newest first.
  results.sort((a, b) => {
    if (a.giver.plan !== b.giver.plan) return a.giver.plan === 'PRO' ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  res.status(200).json({ gigs: results });
});

// GET /gigs/:id
const getGig = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError('Invalid gig id.', 400);

  const gig = await prisma.gig.findUnique({
    where: { id },
    include: {
      giver: {
        select: {
          id: true, name: true, plan: true,
          profile: { select: { photoPath: true, discipline: true, city: true, dayRate: true } },
        },
      },
      contract: { select: { id: true, takerId: true } },
      _count: { select: { applications: true } },
    },
  });
  if (!gig) throw new AppError('Gig not found.', 404);

  const averages = await getAveragesForUsers([gig.giver.id]);

  res.status(200).json({ gig: { ...gig, giverRating: averages[gig.giver.id] } });
});

// PUT /gigs/:id — only the giver, only while still OPEN
const updateGig = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const gig = await prisma.gig.findUnique({ where: { id } });
  if (!gig) throw new AppError('Gig not found.', 404);
  if (gig.giverId !== req.user.id) {
    throw new AppError('Only the giver can edit this gig.', 403);
  }
  if (gig.status !== 'OPEN') {
    throw new AppError('Only open gigs can be edited.', 409);
  }

  const data = validateGigInput({ ...gig, shootDate: gig.shootDate, ...req.body });
  const updated = await prisma.gig.update({ where: { id }, data });

  res.status(200).json({ gig: updated });
});

// DELETE /gigs/:id — hard delete; blocked once a contract exists
const deleteGig = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const gig = await prisma.gig.findUnique({ where: { id }, include: { contract: true } });
  if (!gig) throw new AppError('Gig not found.', 404);
  if (gig.giverId !== req.user.id) {
    throw new AppError('Only the giver can delete this gig.', 403);
  }
  if (gig.contract) {
    throw new AppError('This gig has a contract and cannot be deleted.', 409);
  }

  await prisma.$transaction([
    prisma.application.deleteMany({ where: { gigId: id } }),
    prisma.gig.delete({ where: { id } }),
  ]);

  res.status(200).json({ message: 'Gig deleted.' });
});

module.exports = { createGig, listGigs, getGig, updateGig, deleteGig };
