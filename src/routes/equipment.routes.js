const router = require('express').Router();
const equipment = require('../controllers/equipment.controller');
const authenticate = require('../middleware/authenticate');
const { uploadGearImage } = require('../middleware/uploadImage');

// Mounted at /api/v1/equipment
router.post('/', authenticate, uploadGearImage.single('photo'), equipment.createEquipment);
router.get('/', equipment.listEquipment);
router.get('/:id', equipment.getEquipment);

module.exports = router;
