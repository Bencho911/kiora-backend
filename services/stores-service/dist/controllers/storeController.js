"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const storeRepository_1 = __importDefault(require("../repositories/storeRepository"));
const logger_1 = __importDefault(require("../config/logger"));
// ── Tiendas ────────────────────────────────────────────────────────────────
async function listStores(req, res, next) {
    try {
        const soloActivas = req.query.activas === 'true';
        const stores = await storeRepository_1.default.findAll({ soloActivas });
        res.json({ data: stores, total: stores.length });
    }
    catch (err) {
        next(err);
    }
}
async function getStore(req, res, next) {
    try {
        const store = await storeRepository_1.default.findById(Number(req.params.id));
        if (!store)
            return res.status(404).json({ error: 'Tienda no encontrada.', code: 'STORE_NOT_FOUND' });
        res.json({ data: store });
    }
    catch (err) {
        next(err);
    }
}
async function createStore(req, res, next) {
    try {
        const { nombre, direccion, telefono, factus_prefix, latitud, longitud, fk_ciudad_id } = req.body;
        if (!nombre || !direccion) {
            return res.status(400).json({ error: 'nombre y direccion son requeridos.', code: 'VALIDATION_ERROR' });
        }
        const store = await storeRepository_1.default.create({ nombre, direccion, telefono, factus_prefix, latitud, longitud, fk_ciudad_id });
        logger_1.default.info('Tienda creada', { id: store.id_tienda, nombre: store.nombre });
        res.status(201).json({ data: store });
    }
    catch (err) {
        next(err);
    }
}
async function updateStore(req, res, next) {
    try {
        const id = Number(req.params.id);
        const store = await storeRepository_1.default.update(id, req.body);
        if (!store)
            return res.status(404).json({ error: 'Tienda no encontrada.', code: 'STORE_NOT_FOUND' });
        logger_1.default.info('Tienda actualizada', { id });
        res.json({ data: store });
    }
    catch (err) {
        next(err);
    }
}
/**
 * PATCH /api/stores/:id/estado
 * Cambia el estado de la tienda: ABIERTO | CERRADO | OFFLINE
 * Llamado por orders-service al abrir/cerrar caja, o por el heartbeat del WebSocket.
 */
async function updateStoreEstado(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { estado } = req.body;
        if (!estado) {
            return res.status(400).json({ error: 'El campo estado es requerido.', code: 'VALIDATION_ERROR' });
        }
        const store = await storeRepository_1.default.updateEstado(id, estado.toUpperCase());
        if (!store)
            return res.status(404).json({ error: 'Tienda no encontrada.', code: 'STORE_NOT_FOUND' });
        logger_1.default.info('Estado de tienda actualizado', { id, estado: store.estado });
        res.json({ data: store });
    }
    catch (err) {
        next(err);
    }
}
// ── Mesas ──────────────────────────────────────────────────────────────────
async function listMesas(req, res, next) {
    try {
        const storeId = Number(req.params.id);
        const mesas = await storeRepository_1.default.findMesasByTienda(storeId);
        res.json({ data: mesas, total: mesas.length });
    }
    catch (err) {
        next(err);
    }
}
async function createMesa(req, res, next) {
    try {
        const storeId = Number(req.params.id);
        const { numero } = req.body;
        if (!numero) {
            return res.status(400).json({ error: 'El campo numero es requerido.', code: 'VALIDATION_ERROR' });
        }
        const mesa = await storeRepository_1.default.createMesa(storeId, Number(numero));
        logger_1.default.info('Mesa creada', { storeId, numero: mesa.numero, qr: mesa.qr_code });
        res.status(201).json({ data: mesa });
    }
    catch (err) {
        if (err.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: `La mesa ${req.body.numero} ya existe en esta tienda.`, code: 'MESA_DUPLICATE' });
        }
        next(err);
    }
}
/**
 * GET /api/stores/mesa-by-qr?qr=kiora://tienda=1&mesa=5
 * Usado por la App Móvil al escanear el QR de la mesa.
 */
async function getMesaByQR(req, res, next) {
    try {
        const qr = req.query.qr;
        if (!qr)
            return res.status(400).json({ error: 'El parámetro qr es requerido.', code: 'VALIDATION_ERROR' });
        const mesa = await storeRepository_1.default.findMesaByQR(qr);
        if (!mesa)
            return res.status(404).json({ error: 'Mesa no encontrada o QR inválido.', code: 'MESA_NOT_FOUND' });
        res.json({ data: mesa });
    }
    catch (err) {
        next(err);
    }
}
exports.default = {
    listStores,
    getStore,
    createStore,
    updateStore,
    updateStoreEstado,
    listMesas,
    createMesa,
    getMesaByQR,
};
