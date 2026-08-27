"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storeController_1 = __importDefault(require("../controllers/storeController"));
const router = (0, express_1.Router)();
// ── Tiendas ────────────────────────────────────────────────────────────────
// GET    /api/stores              — Listar todas (query: ?activas=true)
// POST   /api/stores              — Crear tienda
// GET    /api/stores/:id          — Obtener una tienda por ID
// PUT    /api/stores/:id          — Actualizar datos de tienda
// PATCH  /api/stores/:id/estado   — Cambiar estado (ABIERTO|CERRADO|OFFLINE)
router.get('/', storeController_1.default.listStores);
router.post('/', storeController_1.default.createStore);
router.get('/mesa-by-qr', storeController_1.default.getMesaByQR); // Antes de /:id para evitar conflicto
router.get('/:id', storeController_1.default.getStore);
router.put('/:id', storeController_1.default.updateStore);
router.patch('/:id/estado', storeController_1.default.updateStoreEstado);
// ── Mesas de una Tienda ────────────────────────────────────────────────────
// GET    /api/stores/:id/mesas    — Listar mesas de una tienda
// POST   /api/stores/:id/mesas    — Crear mesa en una tienda
router.get('/:id/mesas', storeController_1.default.listMesas);
router.post('/:id/mesas', storeController_1.default.createMesa);
exports.default = router;
