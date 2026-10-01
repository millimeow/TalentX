const router = require('express').Router();
const rental = require('../controllers/rental.controller');
const authenticate = require('../middleware/authenticate');
const uploadPdf = require('../middleware/uploadPdf');

// Mounted at /api/v1/rentals
// (inspection routes live in inspection.routes.js, mounted on the same prefix)
router.post('/', authenticate, rental.createRental);
router.get('/', authenticate, rental.listMyRentals);
router.get('/:id', authenticate, rental.getRental);
router.get('/:id/agreement', authenticate, rental.downloadAgreement);
router.post('/:id/approve', authenticate, uploadPdf.single('agreement'), rental.approveRental);
router.post('/:id/sign-and-pay', authenticate, rental.signAndPay);
router.post('/:id/return', authenticate, rental.confirmReturn);

module.exports = router;
