import express from 'express';
const router = express.Router();
import * as ctrl from '../controllers/incidentsController';

router.get('/', ctrl.getAll);
router.post('/', ctrl.createIncident);
router.put('/:id/estado', ctrl.updateIncidentState);
router.delete('/:id', ctrl.deleteIncident);

export default router;
