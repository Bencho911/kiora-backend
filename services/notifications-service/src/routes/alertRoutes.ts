'use strict';

import express from 'express';
const router = express.Router();
import alertController from '../controllers/alertController.js';

router.get('/', alertController.getAlerts);
router.patch('/:id/read', alertController.markAlertAsRead);

export default router;
