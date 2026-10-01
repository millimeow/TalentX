const router = require('express').Router();
const portfolio = require('../controllers/portfolio.controller');
const authenticate = require('../middleware/authenticate');
const { uploadPortfolioImage } = require('../middleware/uploadImage');

// Mounted at /api/v1
router.post('/portfolio', authenticate, uploadPortfolioImage.single('photo'), portfolio.addPortfolioItem);
router.delete('/portfolio/:id', authenticate, portfolio.deletePortfolioItem);
router.get('/users/:id/portfolio', portfolio.getUserPortfolio);

module.exports = router;
