import express from 'express';
const router = express.Router();
import * as settingsController from '../controllers/settingsController';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';

router.get('/', verifyToken, settingsController.getSettings);
router.get('/internal', settingsController.getSettings); // Para uso entre microservicios
router.put('/', verifyToken, isAdmin, settingsController.updateSettings);

export default router;
