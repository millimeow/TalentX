const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { moveMoney } = require('../utils/wallet');

// GET /wallet
const getWallet = asyncHandler(async (req, res) => {
  const transactions = await prisma.walletTransaction.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ balance: req.user.walletBalance, transactions });
});

// POST /wallet/topup — demo payments only
const topupWallet = asyncHandler(async (req, res) => {
  let amount = req.body.amount === undefined ? 10000 : Number(req.body.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError('Top-up amount must be a positive whole number.', 400);
  }
  if (amount > 1000000) {
    throw new AppError('Demo top-up is capped at 1,000,000.', 400);
  }

  const user = await prisma.$transaction(async (tx) => {
    return moveMoney(tx, req.user.id, amount, 'TOPUP', 'topup', 'Demo money added');
  });

  res.status(200).json({ balance: user.walletBalance, added: amount });
});

module.exports = { getWallet, topupWallet };
