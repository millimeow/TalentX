const router = require('express').Router();
const contract = require('../controllers/contract.controller');
const dispute = require('../controllers/dispute.controller');
const authenticate = require('../middleware/authenticate');
const { uploadDeliverable } = require('../middleware/uploadImage');
const uploadPdf = require('../middleware/uploadPdf');

// Mounted at /api/v1/contracts
router.post('/', authenticate, uploadPdf.single('contract'), contract.createContract);
router.get('/mine', authenticate, contract.listMyContracts);
router.get('/:id', authenticate, contract.getContract);
router.get('/:id/pdf', authenticate, contract.downloadContractPdf);
router.post('/:id/accept', authenticate, contract.acceptContract);
router.post('/:id/deposit', authenticate, contract.depositContract);
router.post('/:id/confirm-shoot', authenticate, contract.confirmShoot);
router.post('/:id/deliver', authenticate, uploadDeliverable.single('file'), contract.deliverContract);
router.post('/:id/approve', authenticate, contract.approveContract);
router.post('/:id/dispute', authenticate, dispute.raiseContractDispute);

module.exports = router;
