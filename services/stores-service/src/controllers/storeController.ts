import { Request, Response, NextFunction } from 'express';
import repo from '../repositories/storeRepository';
import logger from '../config/logger';

// ── Tiendas ────────────────────────────────────────────────────────────────

async function listStores(req: Request, res: Response, next: NextFunction) {
    try {
        const soloActivas = req.query.activas === 'true';
        const stores = await repo.findAll({ soloActivas });
        res.json({ data: stores, total: stores.length });
    } catch (err) {
        next(err);
    }
}

async function getStore(req: Request, res: Response, next: NextFunction) {
    try {
        const store = await repo.findById(Number((req.params.id as string)));
        if (!store) return res.status(404).json({ error: 'Tienda no encontrada.', code: 'STORE_NOT_FOUND' });
        res.json({ data: store });
    } catch (err) {
        next(err);
    }
}

async function createStore(req: Request, res: Response, next: NextFunction) {
    try {
        const { nombre, direccion, telefono, factus_prefix, latitud, longitud, fk_ciudad_id } = req.body;
        if (!nombre || !direccion) {
            return res.status(400).json({ error: 'nombre y direccion son requeridos.', code: 'VALIDATION_ERROR' });
        }
        const store = await repo.create({ nombre, direccion, telefono, factus_prefix, latitud, longitud, fk_ciudad_id });
        logger.info('Tienda creada', { id: store.id_tienda, nombre: store.nombre });
        res.status(201).json({ data: store });
    } catch (err) {
        next(err);
    }
}

async function updateStore(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number((req.params.id as string));
        const store = await repo.update(id, req.body);
        if (!store) return res.status(404).json({ error: 'Tienda no encontrada.', code: 'STORE_NOT_FOUND' });
        logger.info('Tienda actualizada', { id });
        res.json({ data: store });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/stores/:id/estado
 * Cambia el estado de la tienda: ABIERTO | CERRADO | OFFLINE
 * Llamado por orders-service al abrir/cerrar caja, o por el heartbeat del WebSocket.
 */
async function updateStoreEstado(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number((req.params.id as string));
        const { estado } = req.body;
        if (!estado) {
            return res.status(400).json({ error: 'El campo estado es requerido.', code: 'VALIDATION_ERROR' });
        }
        const store = await repo.updateEstado(id, (estado as string).toUpperCase());
        if (!store) return res.status(404).json({ error: 'Tienda no encontrada.', code: 'STORE_NOT_FOUND' });
        logger.info('Estado de tienda actualizado', { id, estado: store.estado });
        res.json({ data: store });
    } catch (err) {
        next(err);
    }
}

// ── Mesas ──────────────────────────────────────────────────────────────────

async function listMesas(req: Request, res: Response, next: NextFunction) {
    try {
        const storeId = Number((req.params.id as string));
        const mesas = await repo.findMesasByTienda(storeId);
        res.json({ data: mesas, total: mesas.length });
    } catch (err) {
        next(err);
    }
}

async function createMesa(req: Request, res: Response, next: NextFunction) {
    try {
        const storeId = Number((req.params.id as string));
        const { numero } = req.body;
        if (!numero) {
            return res.status(400).json({ error: 'El campo numero es requerido.', code: 'VALIDATION_ERROR' });
        }
        const mesa = await repo.createMesa(storeId, Number(numero));
        logger.info('Mesa creada', { storeId, numero: mesa.numero, qr: mesa.qr_code });
        res.status(201).json({ data: mesa });
    } catch (err: unknown) {
        if ((err as any).code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: `La mesa ${req.body.numero} ya existe en esta tienda.`, code: 'MESA_DUPLICATE' });
        }
        next(err);
    }
}

/**
 * GET /api/stores/mesa-by-qr?qr=kiora://tienda=1&mesa=5
 * Usado por la App Móvil al escanear el QR de la mesa.
 */
async function getMesaByQR(req: Request, res: Response, next: NextFunction) {
    try {
        const qr = req.query.qr as string;
        if (!qr) return res.status(400).json({ error: 'El parámetro qr es requerido.', code: 'VALIDATION_ERROR' });
        const mesa = await repo.findMesaByQR(qr);
        if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada o QR inválido.', code: 'MESA_NOT_FOUND' });
        res.json({ data: mesa });
    } catch (err) {
        next(err);
    }
}

export default {
    listStores,
    getStore,
    createStore,
    updateStore,
    updateStoreEstado,
    listMesas,
    createMesa,
    getMesaByQR,
};
