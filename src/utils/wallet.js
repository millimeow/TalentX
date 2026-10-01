// Moves money inside a prisma.$transaction.
// `tx` is the transaction client. Positive amount = money in, negative = money out.
// Always records a WalletTransaction row so the history is visible.
async function moveMoney(tx, userId, amount, type, referenceId, description) {
  const user = await tx.user.update({
    where: { id: userId },
    data: { walletBalance: { increment: amount } },
  });

  if (user.walletBalance < 0) {
    throw new Error('Wallet balance went below zero — rolling back');
  }

  await tx.walletTransaction.create({
    data: { userId, amount, type, referenceId, description },
  });

  return user;
}

module.exports = { moveMoney };
