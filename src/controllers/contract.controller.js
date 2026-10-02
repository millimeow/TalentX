const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { moveMoney } = require('../utils/wallet');
const { saveUpload, fileUrl } = require('../utils/storage');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('../middleware/uploadImage');

// POST /contracts (multipart: contract PDF, body: gigId, takerId, amount)
const createContract = asyncHandler(async (req, res) => {
  const gigId = Number(req.body.gigId);
  const takerId = Number(req.body.takerId);
  const amount = Number(req.body.amount);

  if (!Number.isInteger(gigId) || !Number.isInteger(takerId)) {
    throw new AppError('Gig id and taker id are required.', 400);
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError('Amount must be a positive whole number.', 400);
  }
  if (!req.file) {
    throw new AppError('Please upload the contract PDF.', 400);
  }

  const gig = await prisma.gig.findUnique({ where: { id: gigId }, include: { contract: true } });
  if (!gig) throw new AppError('Gig not found.', 404);
  if (gig.giverId !== req.user.id) {
    throw new AppError('Only the giver can create the contract for this gig.', 403);
  }
  if (gig.contract) {
    throw new AppError('A contract already exists for this gig.', 409);
  }

  const accepted = await prisma.application.findFirst({
    where: { gigId, applicantId: takerId, status: 'ACCEPTED' },
  });
  if (!accepted) {
    throw new AppError('The taker must be the applicant you accepted.', 400);
  }

  const pdfPath = await saveUpload(req.file, 'contracts');

  const contract = await prisma.contract.create({
    data: { gigId, giverId: req.user.id, takerId, pdfPath, amount },
    include: { gig: { select: { title: true } } },
  });

  res.status(201).json({ contract });
});

// GET /contracts/mine — contracts where I am the giver or the taker (dashboard)
const listMyContracts = asyncHandler(async (req, res) => {
  const contracts = await prisma.contract.findMany({
    where: { OR: [{ giverId: req.user.id }, { takerId: req.user.id }] },
    include: {
      gig: { select: { id: true, title: true, status: true } },
      giver: { select: { id: true, name: true } },
      taker: { select: { id: true, name: true } },
      payment: { select: { status: true, heldAmount: true, releasedAmount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ contracts });
});

// GET /contracts/:id
const getContract = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError('Invalid contract id.', 400);

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      gig: { select: { id: true, title: true, status: true, discipline: true, city: true, shootDate: true } },
      giver: { select: { id: true, name: true } },
      taker: { select: { id: true, name: true } },
      payment: true,
    },
  });
  if (!contract) throw new AppError('Contract not found.', 404);

  const isParticipant = req.user.id === contract.giverId || req.user.id === contract.takerId;
  if (!isParticipant && req.user.role !== 'ADMIN') {
    throw new AppError('You are not part of this contract.', 403);
  }

  res.status(200).json({ contract });
});

// GET /contracts/:id/pdf — served only to the giver, the taker and admins.
// Works for both disk paths (local dev) and blob URLs (Vercel): the blob URL
// is never exposed — the file is streamed through this auth-checked endpoint.
const downloadContractPdf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) throw new AppError('Contract not found.', 404);

  const isParticipant = req.user.id === contract.giverId || req.user.id === contract.takerId;
  if (!isParticipant && req.user.role !== 'ADMIN') {
    throw new AppError('Only the giver, the taker or an admin can open this contract PDF.', 403);
  }

  if (/^https?:\/\//.test(contract.pdfPath)) {
    const upstream = await fetch(contract.pdfPath);
    if (!upstream.ok) throw new AppError('Contract PDF file could not be fetched from storage.', 404);
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="studiox-contract-${id}.pdf"`);
    return res.send(buffer);
  }

  const absolutePath = path.join(UPLOADS_DIR, contract.pdfPath);
  if (!fs.existsSync(absolutePath)) {
    throw new AppError('Contract PDF file is missing on the server.', 404);
  }

  res.download(absolutePath, `studiox-contract-${id}.pdf`);
});

// POST /contracts/:id/accept — taker signs by clicking accept
const acceptContract = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) throw new AppError('Contract not found.', 404);
  if (contract.takerId !== req.user.id) {
    throw new AppError('Only the taker can accept this contract.', 403);
  }
  if (contract.takerAccepted) {
    throw new AppError('Contract is already accepted.', 409);
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: { takerAccepted: true },
  });

  res.status(200).json({ contract: updated });
});

// POST /contracts/:id/deposit — giver pays 100% into escrow (Prisma transaction)
const depositContract = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { payment: true, gig: true },
  });
  if (!contract) throw new AppError('Contract not found.', 404);
  if (contract.giverId !== req.user.id) {
    throw new AppError('Only the giver can deposit the amount.', 403);
  }
  if (!contract.takerAccepted) {
    throw new AppError('The taker must accept the contract before you deposit.', 400);
  }
  if (contract.depositPaid) {
    throw new AppError('Deposit already paid for this contract.', 409);
  }
  if (req.user.walletBalance < contract.amount) {
    throw new AppError('Not enough wallet balance. Use "Add demo money" first.', 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    await moveMoney(tx, req.user.id, -contract.amount, 'ESCROW_IN', `contract:${id}`, 'Escrow deposit');
    await tx.contract.update({ where: { id }, data: { depositPaid: true } });
    await tx.gig.update({ where: { id: contract.gigId }, data: { status: 'IN_PROGRESS' } });
    return tx.payment.create({
      data: { contractId: id, amount: contract.amount, heldAmount: contract.amount, releasedAmount: 0, status: 'HELD' },
    });
  });

  res.status(200).json({ payment: result });
});

// POST /contracts/:id/confirm-shoot — giver confirms, first 50% moves to the taker
const confirmShoot = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { payment: true },
  });
  if (!contract) throw new AppError('Contract not found.', 404);
  if (contract.giverId !== req.user.id) {
    throw new AppError('Only the giver can confirm the shoot.', 403);
  }
  if (!contract.depositPaid) {
    throw new AppError('Deposit must be paid first.', 409);
  }
  if (contract.shootConfirmed) {
    throw new AppError('Shoot already confirmed.', 409);
  }

  const firstHalf = Math.floor(contract.amount / 2);
  if (firstHalf <= 0) {
    throw new AppError('Contract amount is too small to split.', 400);
  }

  const payment = await prisma.$transaction(async (tx) => {
    await moveMoney(tx, contract.takerId, firstHalf, 'RELEASE', `contract:${id}`, '50% released after shoot confirmation');
    await tx.contract.update({ where: { id }, data: { shootConfirmed: true } });
    return tx.payment.update({
      where: { contractId: id },
      data: { releasedAmount: { increment: firstHalf } },
    });
  });

  res.status(200).json({ payment, released: firstHalf });
});

// POST /contracts/:id/deliver — taker uploads the deliverable file or a link
const deliverContract = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { url } = req.body;

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) throw new AppError('Contract not found.', 404);
  if (contract.takerId !== req.user.id) {
    throw new AppError('Only the taker can deliver the work.', 403);
  }
  if (!contract.depositPaid) {
    throw new AppError('Deposit must be paid before delivering.', 409);
  }
  if (contract.deliveredAt) {
    throw new AppError('Deliverable already submitted for this contract.', 409);
  }
  if (!req.file && !url) {
    throw new AppError('Upload a deliverable file or provide a link (for large videos).', 400);
  }

  const data = { deliveredAt: new Date() };
  if (req.file) {
    data.deliverablePath = await saveUpload(req.file, 'deliverables');
  }
  if (url) {
    if (!/^https?:\/\//.test(url)) {
      throw new AppError('Links must start with http:// or https://', 400);
    }
    data.deliverableUrl = url;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.contract.update({ where: { id }, data });
    await tx.gig.update({ where: { id: contract.gigId }, data: { status: 'DELIVERED' } });
    return updated;
  });

  res.status(200).json({ contract: updated });
});

// POST /contracts/:id/approve — giver approves, remaining 50% is released
const approveContract = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { payment: true, gig: true },
  });
  if (!contract) throw new AppError('Contract not found.', 404);
  if (contract.giverId !== req.user.id) {
    throw new AppError('Only the giver can approve the delivery.', 403);
  }
  if (!contract.deliveredAt) {
    throw new AppError('The taker has not delivered anything yet.', 409);
  }
  if (contract.completedAt) {
    throw new AppError('Contract is already completed.', 409);
  }

  const openDispute = await prisma.dispute.findFirst({ where: { gigId: contract.gigId, status: 'OPEN' } });
  if (openDispute) {
    throw new AppError('There is an open dispute on this contract. An admin must resolve it.', 409);
  }

  const remaining = contract.payment.heldAmount - contract.payment.releasedAmount;
  if (remaining <= 0) {
    throw new AppError('Nothing left to release for this contract.', 409);
  }

  const payment = await prisma.$transaction(async (tx) => {
    await moveMoney(tx, contract.takerId, remaining, 'RELEASE', `contract:${id}`, 'Remaining 50% released on approval');
    await tx.contract.update({ where: { id }, data: { completedAt: new Date() } });
    await tx.gig.update({ where: { id: contract.gigId }, data: { status: 'COMPLETED' } });
    return tx.payment.update({
      where: { contractId: id },
      data: { releasedAmount: { increment: remaining }, status: 'RELEASED' },
    });
  });

  res.status(200).json({ payment, released: remaining });
});

module.exports = {
  createContract,
  listMyContracts,
  getContract,
  downloadContractPdf,
  acceptContract,
  depositContract,
  confirmShoot,
  deliverContract,
  approveContract,
};
