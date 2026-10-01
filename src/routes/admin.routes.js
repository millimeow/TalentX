const router = require('express').Router();
const admin = require('../controllers/admin.controller');
const dispute = require('../controllers/dispute.controller');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');

// Mounted at /api/v1/admin — everything here needs an admin account
router.use(authenticate, requireAdmin);

router.get('/disputes', dispute.listDisputes);
router.post('/disputes/:id/decide', dispute.decideDispute);
router.get('/flagged', admin.listFlagged);
router.post('/users/:id/suspend', admin.suspendUser);

module.exports = router;
