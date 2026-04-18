'use strict';

const inventoryRepository = require('../repositories/inventoryRepository');
const logger = require('../config/logger');
const env = require('../config/env');

/** Headers salientes hacia otros microservicios (trazabilidad). */
const outgoingHeaders = (req) => {
    const h = { 'Content-Type': 'application/json' };
    const cid = req.headers['x-correlation-id'];
    if (cid) h['x-correlation-id'] = cid;
    return h;
};

/**
 * inventoryController
 * Orquesta la lógica de negocio del inventario.
 * HU14 — upsertSuministra (stock mínimo)
 */

/* ── Proveedores ──────────────────────────────────────────────────────────── */

// GET /api/inventory/suppliers
const getSuppliers = async (req, res, next) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page  || 1, 10));
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || 100, 10)));
        const offset = (page - 1) * limit;
        const [rows, count] = await Promise.all([
            inventoryRepository.findAllSuppliers({ limit, offset }),
            inventoryRepository.countAllSuppliers(),
        ]);
        res.status(200).json({
            data: rows.rows,
            pagination: {
                total: parseInt(count.rows[0].count, 10),
                page,
                limit,
                totalPages: Math.ceil(count.rows[0].count / limit),
            }
        });

    } catch (error) {
        logger.error('Error al obtener proveedores', { error: error.message });
        next(error);
    }
};

// GET /api/inventory/suppliers/:id
const getSupplierById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await inventoryRepository.findSupplierById(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al obtener proveedor', { error: error.message });
        next(error);
    }
};

// POST /api/inventory/suppliers
const createSupplier = async (req, res, next) => {
    const { nom_prov, id_prov, tel_prov, tipoid_prov } = req.body;
    try {
        const result = await inventoryRepository.createSupplier({ id_prov, nom_prov, tel_prov, tipoid_prov });
        logger.info('Proveedor creado', { cod_prov: result.rows[0].cod_prov });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al crear proveedor', { error: error.message });
        next(error);
    }
};

// PUT /api/inventory/suppliers/:id
const updateSupplier = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await inventoryRepository.updateSupplier(id, req.body);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado o ningún campo válido enviado.' });
        }
        logger.info('Proveedor actualizado', { cod_prov: id });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al actualizar proveedor', { error: error.message });
        next(error);
    }
};

// DELETE /api/inventory/suppliers/:id
const deleteSupplier = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await inventoryRepository.removeSupplier(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado.' });
        }
        logger.info('Proveedor eliminado', { cod_prov: id });
        res.status(200).json({ message: 'Proveedor eliminado exitosamente.' });
    } catch (error) {
        logger.error('Error al eliminar proveedor', { error: error.message });
        next(error);
    }
};

/* ── Movimientos de stock ─────────────────────────────────────────────────── */

// GET /api/inventory/movements
const getMovements = async (req, res, next) => {
    try {
        const { cod_prod } = req.query;
        const page   = Math.max(1, parseInt(req.query.page  || 1, 10));
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || 20, 10)));
        const offset = (page - 1) * limit;
        const [rows, count] = await Promise.all([
            inventoryRepository.findAllMovements({ cod_prod: cod_prod ? Number(cod_prod) : null, limit, offset }),
            inventoryRepository.countAllMovements(cod_prod ? Number(cod_prod) : null),
        ]);
        res.status(200).json({
            data: rows.rows,
            pagination: {
                total: parseInt(count.rows[0].count, 10),
                page,
                limit,
                totalPages: Math.ceil(count.rows[0].count / limit),
            }
        });

    } catch (error) {
        logger.error('Error al obtener movimientos', { error: error.message });
        next(error);
    }
};

// POST /api/inventory/movements
const createMovement = async (req, res, next) => {
    const { tipo_mov, cantidad, cod_prod, fecha_mov, fk_cod_prov, fk_id_vent } = req.body;

    try {
        // 1. Guardar el historial en la tabla Inventario
        const result = await inventoryRepository.createMovement({
            tipo_mov, fecha_mov, cantidad, cod_prod, fk_cod_prov, fk_id_vent,
        });
        logger.info('Movimiento registrado', { id_mov: result.rows[0].id_mov, tipo_mov, cod_prod });

        // 2. Sincronización reactiva con retry (exponential backoff)
        const stockDelta = tipo_mov === 'entrada' ? Number(cantidad) : -Number(cantidad);
        const MAX_RETRIES = 3;
        let synced = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const stockRes = await fetch(
                    `${env.productsServiceUrl}/api/products/${cod_prod}/stock`,
                    {
                        method: 'PUT',
                        headers: outgoingHeaders(req),
                        body: JSON.stringify({ cantidad: stockDelta }),
                    }
                );
                if (stockRes.ok) {
                    const stockData = await stockRes.json();
                    logger.info('Stock sincronizado con products-service', {
                        cod_prod, stock_actual: stockData.stock_actual, attempt,
                    });
                    synced = true;
                    break;
                }
                const errBody = await stockRes.text();
                logger.warn(`Intento ${attempt}/${MAX_RETRIES}: fallo al sincronizar stock`, {
                    cod_prod, statusCode: stockRes.status, body: errBody,
                });
                // Si es 409 (stock insuficiente) no reintentar, es un error de negocio
                if (stockRes.status === 409) break;
            } catch (syncErr) {
                logger.warn(`Intento ${attempt}/${MAX_RETRIES}: error de red al sincronizar stock`, {
                    cod_prod, error: syncErr.message,
                });
            }
            // Esperar con backoff exponencial antes del siguiente intento
            if (attempt < MAX_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
            }
        }

        if (!synced) {
            logger.error('FALLO DEFINITIVO: No se pudo sincronizar stock tras todos los reintentos', {
                cod_prod, id_mov: result.rows[0].id_mov,
            });
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        // Idempotencia: si fk_id_vent ya existe para ese cod_prod (unique index)
        if (error.code === '23505' && error.constraint === 'uq_inventario_venta_producto') {
            logger.warn('Movimiento duplicado ignorado (idempotencia)', { fk_id_vent, cod_prod });
            return res.status(200).json({ message: 'Movimiento ya registrado para esta venta.', duplicado: true });
        }
        logger.error('Error al registrar movimiento', { error: error.message });
        next(error);
    }
};

/* ── Suministra (HU14) ────────────────────────────────────────────────────── */

// GET /api/inventory/suministra
const getSuministra = async (req, res, next) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page  || 1, 10));
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || 20, 10)));
        const offset = (page - 1) * limit;
        const [rows, count] = await Promise.all([
            inventoryRepository.findAllSuministra({ limit, offset }),
            inventoryRepository.countAllSuministra(),
        ]);
        res.status(200).json({
            data: rows.rows,
            pagination: {
                total: parseInt(count.rows[0].count, 10),
                page,
                limit,
                totalPages: Math.ceil(count.rows[0].count / limit),
            }
        });

    } catch (error) {
        logger.error('Error al obtener suministra', { error: error.message });
        next(error);
    }
};

// GET /api/inventory/suministra/:id
const getSuministraById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await inventoryRepository.findSuministraById(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro de suministra no encontrado.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al obtener suministra', { error: error.message });
        next(error);
    }
};

/**
 * POST /api/inventory/suministra  (HU14)
 * Crea o actualiza (upsert) el stock de un proveedor-producto.
 * Advierte si el stock queda por debajo del stock_minimo.
 */
const upsertSuministra = async (req, res, next) => {
    const { fk_cod_prov, cod_prod, stock, stock_minimo } = req.body;

    try {
        const result = await inventoryRepository.upsertSuministra({
            fk_cod_prov, cod_prod, stock, stock_minimo
        });
        const row = result.rows[0];

        logger.info('Suministra actualizado', { id: row.id, cod_prod, stock: row.stock });

        // HU14 — Alerta de bajo stock
        const lowStock = row.stock < row.stock_minimo;
        if (lowStock) {
            logger.warn('ALERTA: Stock por debajo del mínimo', {
                id: row.id,
                cod_prod,
                stock: row.stock,
                stock_minimo: row.stock_minimo,
            });
        }

        res.status(200).json({
            ...row,
            alerta_stock_minimo: lowStock,
            mensaje: lowStock
                ? `⚠️ Stock actual (${row.stock}) está por debajo del mínimo configurado (${row.stock_minimo}).`
                : undefined,
        });
    } catch (error) {
        logger.error('Error en upsert de suministra', { error: error.message });
        next(error);
    }
};

// GET /api/inventory/low-stock  (HU14)
const getLowStock = async (_req, res, next) => {
    try {
        const result = await inventoryRepository.findLowStock();
        res.status(200).json(result.rows);
    } catch (error) {
        logger.error('Error al consultar bajo stock', { error: error.message });
        next(error);
    }
};

module.exports = {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getMovements,
    createMovement,
    getSuministra,
    getSuministraById,
    upsertSuministra,
    getLowStock,
};
