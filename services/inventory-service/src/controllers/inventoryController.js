'use strict';

const inventoryRepository = require('../repositories/inventoryRepository');
const inventoryService = require('../services/inventoryService');
const directEmailService = require('../services/directEmailService');
const redisService = require('../services/redisService');
const parsePagination = require('../utils/parsePagination');
const logger = require('../config/logger');

/**
 * inventoryController
 * Responsabilidad: orquestar request → service/repository → response.
 * La lógica de negocio (sync stock, circuit breaker) está en inventoryService.
 */

/* ── Proveedores ──────────────────────────────────────────────────────────── */

// GET /api/inventory/suppliers
const getSuppliers = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 100 });
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
            return res.status(404).json({ error: 'Proveedor no encontrado.', code: 'NOT_FOUND' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al obtener proveedor', { error: error.message });
        next(error);
    }
};

// POST /api/inventory/suppliers
const createSupplier = async (req, res, next) => {
    const { nom_prov, id_prov, tel_prov, tipoid_prov, correo_prov, dir_prov } = req.body;
    try {
        const result = await inventoryRepository.createSupplier({ id_prov, nom_prov, tel_prov, tipoid_prov, correo_prov, dir_prov });
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
            return res.status(404).json({ error: 'Proveedor no encontrado o ningún campo válido enviado.', code: 'NOT_FOUND' });
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
            return res.status(404).json({ error: 'Proveedor no encontrado.', code: 'NOT_FOUND' });
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
        const { page, limit, offset } = parsePagination(req.query);
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
    const { tipo_mov, cantidad, cod_prod, fecha_mov, fk_cod_prov, fk_id_vent, desc_mov, fecha_vencimiento } = req.body;

    try {
        const movement = await inventoryService.registerMovement({
            tipo_mov, cantidad, cod_prod, fecha_mov, fk_cod_prov, fk_id_vent, desc_mov, fecha_vencimiento
        }, req.headers);
        res.status(201).json(movement);
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
        const { page, limit, offset } = parsePagination(req.query);
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
            return res.status(404).json({ error: 'Registro de suministra no encontrado.', code: 'NOT_FOUND' });
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
 */
const upsertSuministra = async (req, res, next) => {
    const { fk_cod_prov, cod_prod, stock, stock_minimo } = req.body;

    try {
        const result = await inventoryRepository.upsertSuministra({
            fk_cod_prov, cod_prod, stock, stock_minimo
        });
        const row = result.rows[0];

        logger.info('Suministra actualizado', { id: row.id, cod_prod, stock: row.stock });

        const lowStock = row.stock <= row.stock_minimo;
        if (lowStock) {
            await directEmailService.sendLowStockEmail({
                cod_prod: row.cod_prod,
                stock_actual: row.stock,
                stock_minimo: row.stock_minimo
            }, null); // Usa ALERT_EMAIL / ADMIN_EMAIL del .env

            await redisService.emitLowStockAlert({
                cod_prod: row.cod_prod,
                stock_actual: row.stock,
                fk_cod_prov: row.fk_cod_prov
            });
            logger.warn('ALERTA: Stock bajo. Notificaciones enviadas.', { id: row.id, stock: row.stock });
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
