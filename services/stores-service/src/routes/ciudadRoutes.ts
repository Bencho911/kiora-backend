import { Router } from 'express';
import ctrl from '../controllers/ciudadController';

const router = Router();

router.get('/', ctrl.listCiudades);
router.post('/', ctrl.createCiudad);
router.get('/:id', ctrl.getCiudad);
router.put('/:id', ctrl.updateCiudad);
router.delete('/:id', ctrl.deleteCiudad);

export default router;
