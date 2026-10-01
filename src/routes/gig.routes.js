const router = require('express').Router();
const gig = require('../controllers/gig.controller');
const authenticate = require('../middleware/authenticate');
const checkPlanLimit = require('../middleware/checkPlanLimit');

// Mounted at /api/v1/gigs
router.post('/', authenticate, checkPlanLimit('gig'), gig.createGig);
router.get('/', gig.listGigs);
router.get('/:id', gig.getGig);
router.put('/:id', authenticate, gig.updateGig);
router.delete('/:id', authenticate, gig.deleteGig);

module.exports = router;
