const router = require('express').Router();
const wallet = require('../controllers/wallet.controller');
const authenticate = require('../middleware/authenticate');

// Mounted at /api/v1/wallet
router.get('/', authenticate, wallet.getWallet);
router.post('/topup', authenticate, wallet.topupWallet);

module.exports = router;
