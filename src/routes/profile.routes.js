const router = require('express').Router();
const profile = require('../controllers/profile.controller');
const authenticate = require('../middleware/authenticate');
const { uploadProfileImage } = require('../middleware/uploadImage');

// Mounted at /api/v1/profile
router.get('/me', authenticate, profile.getMyProfile);
router.put('/me', authenticate, profile.updateMyProfile);
router.post('/me/photo', authenticate, uploadProfileImage.single('photo'), profile.uploadMyPhoto);

module.exports = router;
