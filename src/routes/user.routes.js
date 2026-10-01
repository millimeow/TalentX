const router = require('express').Router();
const profile = require('../controllers/profile.controller');

// Mounted at /api/v1/users — public profile endpoint
router.get('/:id', profile.getPublicUser);

module.exports = router;
