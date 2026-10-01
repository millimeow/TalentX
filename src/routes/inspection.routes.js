const router = require('express').Router();
const inspection = require('../controllers/inspection.controller');
const authenticate = require('../middleware/authenticate');
const { uploadGearImage } = require('../middleware/uploadImage');

// Mounted at /api/v1/rentals (after rental.routes.js — paths do not collide)
router.post('/:id/inspection', authenticate, uploadGearImage.single('photo'), inspection.addInspection);
router.get('/:id/inspections', authenticate, inspection.listInspections);

module.exports = router;
