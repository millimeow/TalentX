const router = require('express').Router();
const { checkAutoReleases } = require('../utils/autoRelease');

// GET /api/v1/jobs/auto-release
// Serverless hosts cannot keep a setInterval alive, so the 5-day escrow
// auto-release runs from a scheduled cron hitting this endpoint instead
// (see the "crons" entry in vercel.json). On Vercel, set CRON_SECRET and the
// platform calls this with "Authorization: Bearer <CRON_SECRET>" automatically.
router.get('/auto-release', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.authorization || '';
    if (header !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Cron authorisation failed.', statusCode: 401 });
    }
  }

  try {
    await checkAutoReleases();
    res.status(200).json({ message: 'Auto-release check complete.' });
  } catch (err) {
    console.error('Cron auto-release failed:', err);
    res.status(500).json({ error: 'Auto-release check failed.', statusCode: 500 });
  }
});

module.exports = router;
