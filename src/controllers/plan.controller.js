const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// POST /plans/upgrade — demo button, no real payment
const upgradePlan = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { plan: 'PRO' },
  });
  res.status(200).json({ user: safeUser(user), message: 'You are now on the PRO plan (demo).' });
});

// POST /plans/downgrade — for testing the limits again
const downgradePlan = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { plan: 'FREE' },
  });
  res.status(200).json({ user: safeUser(user), message: 'Back to the FREE plan.' });
});

module.exports = { upgradePlan, downgradePlan };
