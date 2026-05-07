'use strict';

const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

router.get('/', alertController.getAlerts);
router.patch('/:id/read', alertController.markAlertAsRead);

module.exports = router;
