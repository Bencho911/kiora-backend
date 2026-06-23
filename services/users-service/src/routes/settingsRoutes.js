const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/', verifyToken, settingsController.getSettings);
router.get('/internal', settingsController.getSettings); // Para uso entre microservicios
router.put('/', verifyToken, isAdmin, settingsController.updateSettings);

module.exports = router;
