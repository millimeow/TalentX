const path = require('path');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { UPLOADS_DIR } = require('../middleware/uploadImage');

const CATEGORIES = ['CAMERA', 'LENS', 'LIGHT', 'AUDIO', 'COSTUME', 'PROP', 'STUDIO'];

// POST /equipment (multipart: photo; body: name, category, pricePerDay, deposit, city, description)
const createEquipment = asyncHandler(async (req, res) => {
  const { name, category, city, description } = req.body;
  const pricePerDay = Number(req.body.pricePerDay);
  const deposit = req.body.deposit === undefined || req.body.deposit === '' ? 0 : Number(req.body.deposit);

  if (!name || !category || !city) {
    throw new AppError('Name, category and city are required.', 400);
  }
  if (!CATEGORIES.includes(category)) {
    throw new AppError(`Category must be one of: ${CATEGORIES.join(', ')}.`, 400);
  }
  if (!Number.isInteger(pricePerDay) || pricePerDay <= 0) {
    throw new AppError('Price per day must be a positive whole number.', 400);
  }
  if (!Number.isInteger(deposit) || deposit < 0) {
    throw new AppError('Deposit must be zero or a positive whole number.', 400);
  }

  const equipment = await prisma.equipment.create({
    data: {
      ownerId: req.user.id,
      name,
      category,
      pricePerDay,
      deposit,
      city,
      description: description || null,
      imagePath: req.file ? path.relative(UPLOADS_DIR, req.file.path) : null,
    },
  });

  res.status(201).json({ equipment });
});

// GET /equipment?category=&city=
const listEquipment = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.category) where.category = req.query.category;
  if (req.query.city) where.city = { contains: req.query.city, mode: 'insensitive' };

  const equipment = await prisma.equipment.findMany({
    where,
    include: {
      owner: {
        select: { id: true, name: true, plan: true, profile: { select: { photoPath: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ equipment });
});

// GET /equipment/:id
const getEquipment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError('Invalid equipment id.', 400);

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, plan: true, profile: { select: { photoPath: true, city: true } } },
      },
    },
  });
  if (!equipment) throw new AppError('Equipment not found.', 404);

  res.status(200).json({ equipment });
});

module.exports = { createEquipment, listEquipment, getEquipment };
