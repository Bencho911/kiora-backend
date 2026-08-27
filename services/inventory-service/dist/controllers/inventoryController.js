'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const inventoryRepository_1 = __importDefault(require("../repositories/inventoryRepository"));
const inventoryService_1 = __importDefault(require("../services/inventoryService"));
const directEmailService_1 = __importDefault(require("../services/directEmailService"));
const logActivity_1 = __importDefault(require("../utils/logActivity"));
const redisService_1 = __importDefault(require("../services/redisService"));
const parsePagination_1 = __importDefault(require("../utils/parsePagination"));
const logger_1 = __importDefault(require("../config/logger"));
/**
 * inventoryController
 * Responsabilidad: orquestar request → service/repository → response.
 * La lógica de negocio (sync stock, circuit breaker) está en inventoryService.
 */
/* ── Proveedores ──────────────────────────────────────────────────────────── */
// GET /api/inventory/suppliers
const getSuppliers = async (req, res, next) => {
    try {
        const { page, limit, offset } = (0, parsePagination_1.default)(req.query, { defaultLimit: 100 });
        const [rows, count] = await Promise.all([
            inventoryRepository_1.default.findAllSuppliers({ limit, offset }),
            inventoryRepository_1.default.countAllSuppliers(),
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
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// GET /api/inventory/suppliers/:id
const getSupplierById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await inventoryRepository_1.default.findSupplierById(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado.', code: 'NOT_FOUND' });
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// POST /api/inventory/suppliers
const createSupplier = async (req, res, next) => {
    const { nom_prov, id_prov, tel_prov, tipoid_prov, correo_prov, dir_prov } = req.body;
    try {
        if (id_prov) {
            const existing = await inventoryRepository_1.default.findSupplierByIdProv(id_prov);
            if (existing.rows.length > 0) {
                return res.status(400).json({ error: 'El NIT/ID ya se encuentra registrado para otro proveedor.', code: 'DUPLICATE_ID' });
            }
        }
        const result = await inventoryRepository_1.default.createSupplier({ id_prov, nom_prov, tel_prov, tipoid_prov, correo_prov, dir_prov });
        logger_1.default.info('Proveedor creado', { cod_prov: result.rows[0].cod_prov });
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// PUT /api/inventory/suppliers/:id
const updateSupplier = async (req, res, next) => {
    const { id } = req.params;
    const { id_prov } = req.body;
    try {
        if (id_prov) {
            const existing = await inventoryRepository_1.default.findSupplierByIdProv(id_prov, id);
            if (existing.rows.length > 0) {
                return res.status(400).json({ error: 'El NIT/ID ya se encuentra registrado para otro proveedor.', code: 'DUPLICATE_ID' });
            }
        }
        const result = await inventoryRepository_1.default.updateSupplier(id, req.body);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado o ningún campo válido enviado.', code: 'NOT_FOUND' });
        }
        logger_1.default.info('Proveedor actualizado', { cod_prov: id });
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// DELETE /api/inventory/suppliers/:id
const deleteSupplier = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await inventoryRepository_1.default.removeSupplier(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado.', code: 'NOT_FOUND' });
        }
        logger_1.default.info('Proveedor eliminado', { cod_prov: id });
        res.status(200).json({ message: 'Proveedor eliminado exitosamente.' });
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
/* ── Movimientos de stock ─────────────────────────────────────────────────── */
// GET /api/inventory/movements
const getMovements = async (req, res, next) => {
    try {
        const { cod_prod } = req.query;
        const { page, limit, offset } = (0, parsePagination_1.default)(req.query);
        const [rows, count] = await Promise.all([
            inventoryRepository_1.default.findAllMovements({ cod_prod: cod_prod ? Number(cod_prod) : null, limit, offset }),
            inventoryRepository_1.default.countAllMovements(cod_prod ? Number(cod_prod) : null),
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
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// POST /api/inventory/movements
const createMovement = async (req, res, next) => {
    const { tipo_mov, cantidad, cod_prod, fecha_mov, fk_cod_prov, fk_id_vent, desc_mov, fecha_vencimiento } = req.body;
    try {
        const movement = await inventoryService_1.default.registerMovement({
            tipo_mov, cantidad, cod_prod, fecha_mov, fk_cod_prov, fk_id_vent, desc_mov, fecha_vencimiento
        }, req.headers);
        res.status(201).json(movement);
        (0, logActivity_1.default)({ user_email: req.user?.correo_usu, user_name: req.user?.nombre_usu || 'Sistema', action: 'created', entity_type: 'movement', entity_id: movement.id_mov, details: `${tipo_mov} de ${cantidad} uds — prod #${cod_prod}` });
    }
    catch (error) {
        // Idempotencia: si fk_id_vent ya existe para ese cod_prod (unique index)
        if (error.code === '23505' && error.constraint === 'uq_inventario_venta_producto') {
            logger_1.default.warn('Movimiento duplicado ignorado (idempotencia)', { fk_id_vent, cod_prod });
            return res.status(200).json({ message: 'Movimiento ya registrado para esta venta.', duplicado: true });
        }
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
/* ── Suministra (HU14) ────────────────────────────────────────────────────── */
// GET /api/inventory/suministra
const getSuministra = async (req, res, next) => {
    try {
        const { page, limit, offset } = (0, parsePagination_1.default)(req.query);
        const [rows, count] = await Promise.all([
            inventoryRepository_1.default.findAllSuministra({ limit, offset }),
            inventoryRepository_1.default.countAllSuministra(),
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
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// GET /api/inventory/suministra/:id
const getSuministraById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await inventoryRepository_1.default.findSuministraById(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro de suministra no encontrado.', code: 'NOT_FOUND' });
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// GET /api/inventory/suministra/product/:cod_prod
const getSuministraByProduct = async (req, res, next) => {
    const { cod_prod } = req.params;
    try {
        const result = await inventoryRepository_1.default.findSuministraByProduct(cod_prod);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro de suministra no encontrado para el producto.', code: 'NOT_FOUND' });
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
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
        const result = await inventoryRepository_1.default.upsertSuministra({
            fk_cod_prov, cod_prod, stock, stock_minimo
        });
        const row = result.rows[0];
        logger_1.default.info('Suministra actualizado', { id: row.id, cod_prod, stock: row.stock });
        const lowStock = row.stock <= row.stock_minimo;
        if (lowStock) {
            await directEmailService_1.default.sendLowStockEmail({
                cod_prod: row.cod_prod,
                stock_actual: row.stock,
                stock_minimo: row.stock_minimo
            }, null); // Usa ALERT_EMAIL / ADMIN_EMAIL del .env
            await redisService_1.default.emitLowStockAlert({
                cod_prod: row.cod_prod,
                stock_actual: row.stock,
                fk_cod_prov: row.fk_cod_prov
            });
            logger_1.default.warn('ALERTA: Stock bajo. Notificaciones enviadas.', { id: row.id, stock: row.stock });
        }
        res.status(200).json({
            ...row,
            alerta_stock_minimo: lowStock,
            mensaje: lowStock
                ? `⚠️ Stock actual (${row.stock}) está por debajo del mínimo configurado (${row.stock_minimo}).`
                : undefined,
        });
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// GET /api/inventory/alerts  (Kardex/Lotes)
const getAlerts = async (_req, res, next) => {
    try {
        const result = await inventoryRepository_1.default.getAlerts();
        res.status(200).json(result);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// GET /api/inventory/products/:id/kardex
const getKardex = async (req, res, next) => {
    const { id } = req.params;
    try {
        const movimientos = await inventoryRepository_1.default.getKardexByProduct(id);
        const lotes = await inventoryRepository_1.default.findLotesByProduct(id);
        res.status(200).json({
            movimientos: movimientos.rows,
            lotes: lotes.rows
        });
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// GET /api/inventory/products/:id/lotes
const getLotesByProduct = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await inventoryRepository_1.default.findLotesByProduct(id);
        res.status(200).json(result.rows);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
const getLowStock = async (_req, res, next) => {
    try {
        const result = await inventoryRepository_1.default.findLowStock();
        res.status(200).json(result.rows);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
// DELETE /api/inventory/lotes/:id
const deleteLote = async (req, res, next) => {
    const { id } = req.params;
    try {
        await inventoryRepository_1.default.deleteLote(id);
        res.status(200).json({ message: 'Lote eliminado exitosamente' });
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.default = {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getMovements,
    createMovement,
    getSuministra,
    getSuministraById,
    getSuministraByProduct,
    upsertSuministra,
    getLowStock,
    getAlerts,
    getKardex,
    getLotesByProduct,
    deleteLote,
};
