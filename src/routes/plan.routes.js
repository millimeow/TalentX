const router = require('express').Router();
const plan = require('../controllers/plan.controller');
const authenticate = require('../middleware/authenticate');

// Mounted at /api/v1/plans
router.post('/upgrade', authenticate, plan.upgradePlan);
router.post('/downgrade', authenticate, plan.downgradePlan);

module.exports = router;
