const router = require('express').Router();
const prisma = require('../utils/prisma');
const { useBlob } = require('../utils/storage');

// GET /api/v1/health — public deployment self-check.
// Tells you (and your users) whether a deployment is configured correctly:
// database reachable, OAuth on/off, where uploads are stored.
router.get('/', async (req, res) => {
  let database = 'unreachable';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'reachable';
  } catch {
    database = 'unreachable';
  }

  res.status(200).json({
    ok: database === 'reachable',
    database,
    googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
    uploads: useBlob() ? 'blob (persistent)' : 'disk (persistent only on hosts with a disk)',
    time: new Date().toISOString(),
  });
});

module.exports = router;
