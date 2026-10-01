const router = require('express').Router();
const rating = require('../controllers/rating.controller');
const authenticate = require('../middleware/authenticate');

// Mounted at /api/v1
router.post('/ratings', authenticate, rating.createRating);
router.get('/users/:id/ratings', rating.listUserRatings);

module.exports = router;
