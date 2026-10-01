const prisma = require('./prisma');
const { moveMoney } = require('./wallet');

// If the giver does nothing for 5 days after delivery, the remaining 50%
// is released to the taker automatically. Runs on server start and every hour.
const AUTO_RELEASE_DAYS = 5;

async function checkAutoReleases() {
  const cutoff = new Date(Date.now() - AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000);

  const contracts = await prisma.contract.findMany({
    where: {
      deliveredAt: { lte: cutoff },
      completedAt: null,
    },
    include: { payment: true, gig: true },
  });

  for (const contract of contracts) {
    const openDispute = await prisma.dispute.findFirst({
      where: { gigId: contract.gigId, status: 'OPEN' },
    });
    if (openDispute) continue;

    const payment = contract.payment;
    if (!payment) continue;
    const remaining = payment.heldAmount - payment.releasedAmount;
    if (remaining <= 0) continue;

    try {
      await prisma.$transaction(async (tx) => {
        await moveMoney(tx, contract.takerId, remaining, 'RELEASE', `contract:${contract.id}`, 'Remaining 50% released automatically (5 days after delivery)');
        await tx.contract.update({ where: { id: contract.id }, data: { completedAt: new Date() } });
        await tx.gig.update({ where: { id: contract.gigId }, data: { status: 'COMPLETED' } });
        await tx.payment.update({
          where: { id: payment.id },
          data: { releasedAmount: { increment: remaining }, status: 'RELEASED' },
        });
      });
      console.log(`[auto-release] Contract #${contract.id}: released ${remaining} to taker #${contract.takerId}`);
    } catch (err) {
      console.error(`[auto-release] Failed for contract #${contract.id}:`, err.message);
    }
  }
}

module.exports = { checkAutoReleases };
