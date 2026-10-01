const router = require('express').Router();
const application = require('../controllers/application.controller');
const authenticate = require('../middleware/authenticate');
const checkPlanLimit = require('../middleware/checkPlanLimit');

// Mounted at /api/v1
router.get('/applications/mine', authenticate, application.listMyApplications);
router.post('/gigs/:id/apply', authenticate, checkPlanLimit('application'), application.applyToGig);
router.get('/gigs/:id/applications', authenticate, application.listApplications);
router.post('/applications/:id/accept', authenticate, application.acceptApplication);

module.exports = router;
