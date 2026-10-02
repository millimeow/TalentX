const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { moveMoney } = require('../utils/wallet');
const { saveUpload } = require('../utils/storage');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('../middleware/uploadImage');

// POST /rentals — renter requests dates; overlapping approved bookings are blocked
const createRental = asyncHandler(async (req, res) => {
  const equipmentId = Number(req.body.equipmentId);
  const startDate = new Date(req.body.startDate);
  const endDate = new Date(req.body.endDate);

  if (!Number.isInteger(equipmentId)) throw new AppError('Equipment id is required.', 400);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new AppError('Start and end dates must be valid dates.', 400);
  }
  if (startDate >= endDate) {
    throw new AppError('End date must be after start date.', 400);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (startDate < today) {
    throw new AppError('Start date cannot be in the past.', 400);
  }

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) throw new AppError('Equipment not found.', 404);
  if (equipment.ownerId === req.user.id) {
    throw new AppError('You cannot rent your own gear.', 403);
  }

  // Block overlapping approved/active bookings
  const overlapping = await prisma.rental.findFirst({
    where: {
      equipmentId,
      status: { in: ['APPROVED', 'ACTIVE'] },
      startDate: { lt: endDate },
      endDate: { gt: startDate },
    },
  });
  if (overlapping) {
    throw new AppError('These dates overlap an already approved booking. Pick other dates.', 409);
  }

  const rental = await prisma.rental.create({
    data: { equipmentId, renterId: req.user.id, startDate, endDate },
    include: { equipment: { select: { name: true, pricePerDay: true } } },
  });

  res.status(201).json({ rental });
});

// POST /rentals/:id/approve (multipart: agreement PDF) — owner only
const approveRental = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rental = await prisma.rental.findUnique({ where: { id }, include: { equipment: true } });
  if (!rental) throw new AppError('Rental not found.', 404);
  if (rental.equipment.ownerId !== req.user.id) {
    throw new AppError('Only the owner can approve this rental.', 403);
  }
  if (rental.status !== 'PENDING') {
    throw new AppError('Only pending rental requests can be approved.', 409);
  }
  if (!req.file) {
    throw new AppError('Please upload the rental agreement PDF.', 400);
  }

  const agreementPdfPath = await saveUpload(req.file, 'contracts');
  const days = Math.max(1, Math.ceil((rental.endDate - rental.startDate) / (24 * 60 * 60 * 1000)));

  const updated = await prisma.rental.update({
    where: { id },
    data: {
      status: 'APPROVED',
      agreementPdfPath,
      rentAmount: rental.equipment.pricePerDay * days,
      depositAmount: rental.equipment.deposit,
    },
  });

  res.status(200).json({ rental: updated });
});

// POST /rentals/:id/sign-and-pay — renter pays rent + deposit into escrow
const signAndPay = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rental = await prisma.rental.findUnique({ where: { id }, include: { payment: true } });
  if (!rental) throw new AppError('Rental not found.', 404);
  if (rental.renterId !== req.user.id) {
    throw new AppError('Only the renter can sign and pay.', 403);
  }
  if (rental.status !== 'APPROVED') {
    throw new AppError('The owner must approve this rental first.', 409);
  }
  if (rental.payment) {
    throw new AppError('Payment already made for this rental.', 409);
  }

  const total = rental.rentAmount + rental.depositAmount;
  if (req.user.walletBalance < total) {
    throw new AppError(`Not enough wallet balance. You need ${total}. Use "Add demo money" first.`, 400);
  }

  const payment = await prisma.$transaction(async (tx) => {
    await moveMoney(tx, req.user.id, -total, 'ESCROW_IN', `rental:${id}`, 'Rent + deposit into escrow');
    await tx.rental.update({ where: { id }, data: { status: 'ACTIVE' } });
    return tx.payment.create({
      data: { rentalId: id, amount: total, heldAmount: total, releasedAmount: 0, status: 'HELD' },
    });
  });

  res.status(200).json({ payment, total });
});

// POST /rentals/:id/return — owner confirms good condition: rent to owner, deposit back to renter
const confirmReturn = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rental = await prisma.rental.findUnique({
    where: { id },
    include: { equipment: true, payment: true },
  });
  if (!rental) throw new AppError('Rental not found.', 404);
  if (rental.equipment.ownerId !== req.user.id) {
    throw new AppError('Only the owner can confirm the return.', 403);
  }
  if (rental.status !== 'ACTIVE') {
    throw new AppError('Only active rentals can be returned.', 409);
  }

  const payment = rental.payment;
  if (!payment) throw new AppError('No payment found for this rental.', 409);
  const remaining = payment.heldAmount - payment.releasedAmount;

  const updated = await prisma.$transaction(async (tx) => {
    if (rental.rentAmount > 0) {
      await moveMoney(tx, rental.equipment.ownerId, rental.rentAmount, 'RELEASE', `rental:${id}`, 'Rent released for the rental');
    }
    if (rental.depositAmount > 0) {
      await moveMoney(tx, rental.renterId, rental.depositAmount, 'REFUND', `rental:${id}`, 'Deposit refunded — returned in good condition');
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: { releasedAmount: { increment: remaining }, status: 'RELEASED' },
    });
    return tx.rental.update({ where: { id }, data: { status: 'RETURNED' } });
  });

  res.status(200).json({ rental: updated });
});

// GET /rentals — rentals where I am the renter or the owner
const listMyRentals = asyncHandler(async (req, res) => {
  const rentals = await prisma.rental.findMany({
    where: {
      OR: [{ renterId: req.user.id }, { equipment: { ownerId: req.user.id } }],
    },
    include: {
      equipment: { include: { owner: { select: { id: true, name: true } } } },
      renter: { select: { id: true, name: true } },
      payment: true,
      _count: { select: { inspections: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ rentals });
});

// GET /rentals/:id
const getRental = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError('Invalid rental id.', 400);

  const rental = await prisma.rental.findUnique({
    where: { id },
    include: {
      equipment: { include: { owner: { select: { id: true, name: true } } } },
      renter: { select: { id: true, name: true } },
      payment: true,
      inspections: { include: { byUser: { select: { id: true, name: true } } } },
    },
  });
  if (!rental) throw new AppError('Rental not found.', 404);

  const isParticipant = rental.renterId === req.user.id || rental.equipment.ownerId === req.user.id;
  if (!isParticipant && req.user.role !== 'ADMIN') {
    throw new AppError('You are not part of this rental.', 403);
  }

  res.status(200).json({ rental });
});

// GET /rentals/:id/agreement — agreement PDF, participants only (blob URLs are
// streamed through this auth-checked endpoint and never exposed directly).
const downloadAgreement = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rental = await prisma.rental.findUnique({
    where: { id },
    include: { equipment: true },
  });
  if (!rental) throw new AppError('Rental not found.', 404);
  if (!rental.agreementPdfPath) throw new AppError('No agreement uploaded yet.', 404);

  const isParticipant = rental.renterId === req.user.id || rental.equipment.ownerId === req.user.id;
  if (!isParticipant && req.user.role !== 'ADMIN') {
    throw new AppError('Only the owner, the renter or an admin can open the agreement.', 403);
  }

  if (/^https?:\/\//.test(rental.agreementPdfPath)) {
    const upstream = await fetch(rental.agreementPdfPath);
    if (!upstream.ok) throw new AppError('Agreement PDF could not be fetched from storage.', 404);
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="studiox-rental-${id}-agreement.pdf"`);
    return res.send(buffer);
  }

  const absolutePath = path.join(UPLOADS_DIR, rental.agreementPdfPath);
  if (!fs.existsSync(absolutePath)) {
    throw new AppError('Agreement PDF file is missing on the server.', 404);
  }
  res.download(absolutePath, `studiox-rental-${id}-agreement.pdf`);
});

module.exports = { createRental, approveRental, signAndPay, confirmReturn, listMyRentals, getRental, downloadAgreement };
