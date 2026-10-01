const router = require('express').Router();
const dispute = require('../controllers/dispute.controller');
const authenticate = require('../middleware/authenticate');

// Mounted at /api/v1
// (the gig dispute endpoint POST /contracts/:id/dispute lives in contract.routes.js)
router.post('/rentals/:id/dispute', authenticate, dispute.raiseRentalDispute);

module.exports = router;
