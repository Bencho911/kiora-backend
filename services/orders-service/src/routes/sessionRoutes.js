const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

// El API Gateway ya valida el token y añade headers x-user-* (si la ruta está protegida)
router.post('/open', sessionController.openSession);
router.post('/close', sessionController.closeSession);
router.get('/current', sessionController.getCurrentSession);
router.get('/history', sessionController.getSessionsHistory);

module.exports = router;
