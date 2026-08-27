import express from 'express';
import * as sessionController from '../controllers/sessionController';

const router = express.Router();

// El API Gateway ya valida el token y añade headers x-user-* (si la ruta está protegida)
router.post('/open', sessionController.openSession);
router.post('/close', sessionController.closeSession);
router.get('/current', sessionController.getCurrentSession);
router.get('/history', sessionController.getSessionsHistory);
router.get('/:id/report', sessionController.getSessionReport);

export default router;
