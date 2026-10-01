const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { moveMoney } = require('../utils/wallet');

// POST /contracts/:id/dispute — giver or taker freezes the remaining 50%
const raiseContractDispute = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    throw new AppError('Please describe the reason for the dispute.', 400);
  }

  const contract = await prisma.contract.findUnique({ where: { id }, include: { gig: true } });
  if (!contract) throw new AppError('Contract not found.', 404);
  if (req.user.id !== contract.giverId && req.user.id !== contract.takerId) {
    throw new AppError('Only the giver or the taker can raise a dispute.', 403);
  }

  const existing = await prisma.dispute.findFirst({ where: { gigId: contract.gigId, status: 'OPEN' } });
  if (existing) {
    throw new AppError('There is already an open dispute for this gig.', 409);
  }

  const dispute = await prisma.$transaction(async (tx) => {
    const dispute = await tx.dispute.create({
      data: {
        gigId: contract.gigId,
        raisedById: req.user.id,
        reason: reason.trim(),
      },
    });
    await tx.gig.update({ where: { id: contract.gigId }, data: { status: 'DISPUTED' } });
    return dispute;
  });

  res.status(201).json({ dispute });
});

// POST /rentals/:id/dispute — freezes rent + deposit
const raiseRentalDispute = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    throw new AppError('Please describe the reason for the dispute.', 400);
  }

  const rental = await prisma.rental.findUnique({ where: { id }, include: { equipment: true } });
  if (!rental) throw new AppError('Rental not found.', 404);
  const isOwner = rental.equipment.ownerId === req.user.id;
  const isRenter = rental.renterId === req.user.id;
  if (!isOwner && !isRenter) {
    throw new AppError('Only the owner or the renter can raise a dispute.', 403);
  }
  if (rental.status === 'PENDING') {
    throw new AppError('Disputes can be raised once the rental is approved.', 409);
  }

  const existing = await prisma.dispute.findFirst({ where: { rentalId: id, status: 'OPEN' } });
  if (existing) {
    throw new AppError('There is already an open dispute for this rental.', 409);
  }

  const dispute = await prisma.$transaction(async (tx) => {
    const dispute = await tx.dispute.create({
      data: { rentalId: id, raisedById: req.user.id, reason: reason.trim() },
    });
    await tx.rental.update({ where: { id }, data: { status: 'DISPUTED' } });
    return dispute;
  });

  res.status(201).json({ dispute });
});

// GET /admin/disputes
const listDisputes = asyncHandler(async (req, res) => {
  const disputes = await prisma.dispute.findMany({
    include: {
      raisedBy: { select: { id: true, name: true } },
      gig: {
        include: {
          contract: {
            include: {
              giver: { select: { id: true, name: true } },
              taker: { select: { id: true, name: true } },
              payment: true,
            },
          },
        },
      },
      rental: {
        include: {
          equipment: { include: { owner: { select: { id: true, name: true } } } },
          renter: { select: { id: true, name: true } },
          payment: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.status(200).json({ disputes });
});

// POST /admin/disputes/:id/decide  body: { decision }
// Gig disputes:     RELEASE_TO_TAKER | REFUND_TO_GIVER | SPLIT
// Rental disputes:  RELEASE_TO_OWNER | REFUND_TO_RENTER | SPLIT
const GIG_DECISIONS = ['RELEASE_TO_TAKER', 'REFUND_TO_GIVER', 'SPLIT'];
const RENTAL_DECISIONS = ['RELEASE_TO_OWNER', 'REFUND_TO_RENTER', 'SPLIT'];

const decideDispute = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { decision } = req.body;

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      gig: { include: { contract: { include: { payment: true } } } },
      rental: { include: { equipment: true, payment: true } },
    },
  });
  if (!dispute) throw new AppError('Dispute not found.', 404);
  if (dispute.status === 'RESOLVED') {
    throw new AppError('This dispute is already resolved.', 409);
  }

  // ---- Gig dispute ----
  if (dispute.gigId) {
    if (!GIG_DECISIONS.includes(decision)) {
      throw new AppError('Decision must be RELEASE_TO_TAKER, REFUND_TO_GIVER or SPLIT.', 400);
    }

    const contract = dispute.gig.contract;
    const payment = contract && contract.payment;
    const remaining = payment ? payment.heldAmount - payment.releasedAmount : 0;

    await prisma.$transaction(async (tx) => {
      if (remaining > 0) {
        if (decision === 'RELEASE_TO_TAKER') {
          await moveMoney(tx, contract.takerId, remaining, 'RELEASE', `contract:${contract.id}`, 'Admin released the escrow to the taker');
          await tx.payment.update({ where: { id: payment.id }, data: { releasedAmount: { increment: remaining }, status: 'RELEASED' } });
        } else if (decision === 'REFUND_TO_GIVER') {
          await moveMoney(tx, contract.giverId, remaining, 'REFUND', `contract:${contract.id}`, 'Admin refunded the escrow to the giver');
          await tx.payment.update({ where: { id: payment.id }, data: { releasedAmount: { increment: remaining }, status: 'REFUNDED' } });
        } else {
          const half = Math.floor(remaining / 2);
          if (half > 0) await moveMoney(tx, contract.takerId, half, 'RELEASE', `contract:${contract.id}`, 'Admin split the escrow (taker share)');
          if (remaining - half > 0) await moveMoney(tx, contract.giverId, remaining - half, 'REFUND', `contract:${contract.id}`, 'Admin split the escrow (giver share)');
          await tx.payment.update({ where: { id: payment.id }, data: { releasedAmount: { increment: remaining }, status: 'SPLIT' } });
        }
      }

      await tx.contract.update({ where: { id: contract.id }, data: { completedAt: new Date() } });
      await tx.gig.update({
        where: { id: dispute.gigId },
        data: { status: decision === 'REFUND_TO_GIVER' ? 'CANCELLED' : 'COMPLETED' },
      });
      await tx.dispute.update({
        where: { id },
        data: { status: 'RESOLVED', decision, decidedById: req.user.id, decidedAt: new Date() },
      });
    });

    return res.status(200).json({ message: `Dispute resolved: ${decision}.` });
  }

  // ---- Rental dispute ----
  if (dispute.rentalId) {
    if (!RENTAL_DECISIONS.includes(decision)) {
      throw new AppError('Decision must be RELEASE_TO_OWNER, REFUND_TO_RENTER or SPLIT.', 400);
    }

    const rental = dispute.rental;
    const payment = rental.payment;
    const remaining = payment ? payment.heldAmount - payment.releasedAmount : 0;
    const ownerId = rental.equipment.ownerId;

    await prisma.$transaction(async (tx) => {
      if (remaining > 0) {
        if (decision === 'RELEASE_TO_OWNER') {
          await moveMoney(tx, ownerId, remaining, 'RELEASE', `rental:${rental.id}`, 'Admin released the rental escrow to the owner');
          await tx.payment.update({ where: { id: payment.id }, data: { releasedAmount: { increment: remaining }, status: 'RELEASED' } });
        } else if (decision === 'REFUND_TO_RENTER') {
          await moveMoney(tx, rental.renterId, remaining, 'REFUND', `rental:${rental.id}`, 'Admin refunded the rental escrow to the renter');
          await tx.payment.update({ where: { id: payment.id }, data: { releasedAmount: { increment: remaining }, status: 'REFUNDED' } });
        } else {
          // rent to the owner, deposit split in half
          const deposit = rental.depositAmount || 0;
          const depositShare = Math.min(deposit, Math.floor(deposit / 2));
          const ownerShare = remaining - depositShare;
          if (ownerShare > 0) await moveMoney(tx, ownerId, ownerShare, 'RELEASE', `rental:${rental.id}`, 'Admin split the rental escrow (rent + half deposit)');
          if (depositShare > 0) await moveMoney(tx, rental.renterId, depositShare, 'REFUND', `rental:${rental.id}`, 'Admin split the rental escrow (half deposit back)');
          await tx.payment.update({ where: { id: payment.id }, data: { releasedAmount: { increment: remaining }, status: 'SPLIT' } });
        }
      }

      await tx.rental.update({
        where: { id: rental.id },
        data: { status: decision === 'REFUND_TO_RENTER' ? 'CANCELLED' : 'RETURNED' },
      });
      await tx.dispute.update({
        where: { id },
        data: { status: 'RESOLVED', decision, decidedById: req.user.id, decidedAt: new Date() },
      });
    });

    return res.status(200).json({ message: `Dispute resolved: ${decision}.` });
  }

  throw new AppError('This dispute is not linked to a gig or rental.', 400);
});

module.exports = { raiseContractDispute, raiseRentalDispute, listDisputes, decideDispute };
