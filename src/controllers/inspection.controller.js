const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { saveUpload } = require('../utils/storage');

// POST /rentals/:id/inspection (multipart: photo; body: type, note, conditionScore)
// Added by both sides: PRE before the gear goes out, POST after it comes back.
const addInspection = asyncHandler(async (req, res) => {
  const rentalId = Number(req.params.id);
  const { type, note } = req.body;
  const conditionScore = Number(req.body.conditionScore);

  if (!['PRE', 'POST'].includes(type)) {
    throw new AppError('Inspection type must be PRE or POST.', 400);
  }
  if (!Number.isInteger(conditionScore) || conditionScore < 1 || conditionScore > 5) {
    throw new AppError('Condition score must be between 1 and 5.', 400);
  }

  const rental = await prisma.rental.findUnique({ where: { id: rentalId }, include: { equipment: true } });
  if (!rental) throw new AppError('Rental not found.', 404);
  const isOwner = rental.equipment.ownerId === req.user.id;
  const isRenter = rental.renterId === req.user.id;
  if (!isOwner && !isRenter) {
    throw new AppError('Only the owner or the renter can add inspections.', 403);
  }
  if (rental.status !== 'ACTIVE' && rental.status !== 'DISPUTED') {
    throw new AppError('Inspections can be added once the rental is paid (active).', 409);
  }

  const inspection = await prisma.inspection.create({
    data: {
      rentalId,
      type,
      note: note || null,
      conditionScore,
      photoPath: req.file ? await saveUpload(req.file, 'photos') : null,
      byUserId: req.user.id,
    },
    include: { byUser: { select: { id: true, name: true } } },
  });

  res.status(201).json({ inspection });
});

// GET /rentals/:id/inspections
const listInspections = asyncHandler(async (req, res) => {
  const rentalId = Number(req.params.id);

  const rental = await prisma.rental.findUnique({ where: { id: rentalId }, include: { equipment: true } });
  if (!rental) throw new AppError('Rental not found.', 404);
  const isOwner = rental.equipment.ownerId === req.user.id;
  const isRenter = rental.renterId === req.user.id;
  if (!isOwner && !isRenter && req.user.role !== 'ADMIN') {
    throw new AppError('You are not part of this rental.', 403);
  }

  const inspections = await prisma.inspection.findMany({
    where: { rentalId },
    include: { byUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  res.status(200).json({ inspections });
});

module.exports = { addInspection, listInspections };
