import { Router } from 'express';
import ctrl from '../controllers/regionController';

const router = Router();

router.get('/', ctrl.listRegiones);
router.post('/', ctrl.createRegion);
router.get('/:id', ctrl.getRegion);
router.put('/:id', ctrl.updateRegion);
router.delete('/:id', ctrl.deleteRegion);

export default router;
