import { Router } from 'express';
import ctrl from '../controllers/storeController';

const router = Router();

// ── Tiendas ────────────────────────────────────────────────────────────────
// GET    /api/stores              — Listar todas (query: ?activas=true)
// POST   /api/stores              — Crear tienda
// GET    /api/stores/:id          — Obtener una tienda por ID
// PUT    /api/stores/:id          — Actualizar datos de tienda
// PATCH  /api/stores/:id/estado   — Cambiar estado (ABIERTO|CERRADO|OFFLINE)

router.get('/',         ctrl.listStores);
router.post('/',        ctrl.createStore);
router.get('/mesa-by-qr', ctrl.getMesaByQR);  // Antes de /:id para evitar conflicto
router.get('/:id',      ctrl.getStore);
router.put('/:id',      ctrl.updateStore);
router.patch('/:id/estado', ctrl.updateStoreEstado);

// ── Mesas de una Tienda ────────────────────────────────────────────────────
// GET    /api/stores/:id/mesas    — Listar mesas de una tienda
// POST   /api/stores/:id/mesas    — Crear mesa en una tienda

router.get('/:id/mesas',  ctrl.listMesas);
router.post('/:id/mesas', ctrl.createMesa);

export default router;
