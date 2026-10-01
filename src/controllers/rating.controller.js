const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { averageOfRatings } = require('../utils/ratings');

function validateScores(body, requireEquipmentCare) {
  const fields = ['professionalism', 'punctuality', 'quality', 'communication'];
  const scores = {};
  for (const field of fields) {
    const value = Number(body[field]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new AppError(`Score "${field}" must be a whole number from 1 to 5.`, 400);
    }
    scores[field] = value;
  }
  if (requireEquipmentCare) {
    const value = Number(body.equipmentCare);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new AppError('Score "equipmentCare" must be a whole number from 1 to 5 for rentals.', 400);
    }
    scores.equipmentCare = value;
  } else {
    scores.equipmentCare = null;
  }
  return scores;
}

// POST /ratings — one rating per person per gig or rental, after completion
const createRating = asyncHandler(async (req, res) => {
  const gigId = req.body.gigId ? Number(req.body.gigId) : null;
  const rentalId = req.body.rentalId ? Number(req.body.rentalId) : null;
  const toUserId = Number(req.body.toUserId);

  if (!gigId && !rentalId) {
    throw new AppError('A gig id or a rental id is required.', 400);
  }
  if (gigId && rentalId) {
    throw new AppError('Rate either a gig or a rental, not both.', 400);
  }
  if (!Number.isInteger(toUserId)) {
    throw new AppError('Who are you rating? toUserId is required.', 400);
  }

  let comment = req.body.comment || null;

  if (gigId) {
    const gig = await prisma.gig.findUnique({ where: { id: gigId }, include: { contract: true } });
    if (!gig) throw new AppError('Gig not found.', 404);
    if (gig.status !== 'COMPLETED') {
      throw new AppError('You can rate each other once the gig is completed.', 409);
    }
    if (!gig.contract) throw new AppError('This gig has no contract.', 409);

    const isGiver = gig.giverId === req.user.id;
    const isTaker = gig.contract.takerId === req.user.id;
    if (isGiver && isTaker) throw new AppError('You cannot rate yourself.', 400);
    if (!isGiver && !isTaker) {
      throw new AppError('Only the giver and the taker can rate this gig.', 403);
    }
    const expectedOther = isGiver ? gig.contract.takerId : gig.giverId;
    if (toUserId !== expectedOther) {
      throw new AppError('You can only rate the other side of this gig.', 400);
    }

    const scores = validateScores(req.body, false);

    const existing = await prisma.rating.findUnique({ where: { gigId_fromUserId: { gigId, fromUserId: req.user.id } } });
    if (existing) {
      throw new AppError('You already rated this gig.', 409);
    }

    const rating = await prisma.rating.create({
      data: { fromUserId: req.user.id, toUserId, gigId, ...scores, comment },
    });
    return res.status(201).json({ rating });
  }

  if (rentalId) {
    const rental = await prisma.rental.findUnique({ where: { id: rentalId }, include: { equipment: true } });
    if (!rental) throw new AppError('Rental not found.', 404);
    if (rental.status !== 'RETURNED') {
      throw new AppError('You can rate each other once the gear is returned.', 409);
    }

    const isOwner = rental.equipment.ownerId === req.user.id;
    const isRenter = rental.renterId === req.user.id;
    if (isOwner && isRenter) throw new AppError('You cannot rate yourself.', 400);
    if (!isOwner && !isRenter) {
      throw new AppError('Only the owner and the renter can rate this rental.', 403);
    }
    const expectedOther = isOwner ? rental.renterId : rental.equipment.ownerId;
    if (toUserId !== expectedOther) {
      throw new AppError('You can only rate the other side of this rental.', 400);
    }

    const scores = validateScores(req.body, true);

    const existing = await prisma.rating.findUnique({ where: { rentalId_fromUserId: { rentalId, fromUserId: req.user.id } } });
    if (existing) {
      throw new AppError('You already rated this rental.', 409);
    }

    const rating = await prisma.rating.create({
      data: { fromUserId: req.user.id, toUserId, rentalId, ...scores, comment },
    });
    return res.status(201).json({ rating });
  }
});

// GET /users/:id/ratings
const listUserRatings = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) throw new AppError('Invalid user id.', 400);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found.', 404);

  const ratings = await prisma.rating.findMany({
    where: { toUserId: userId },
    include: { fromUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const average = averageOfRatings(ratings);

  res.status(200).json({
    ratings,
    average,
    count: ratings.length,
    flaggedForReview: ratings.length >= 5 && average !== null && average < 2.0,
  });
});

module.exports = { createRating, listUserRatings };
