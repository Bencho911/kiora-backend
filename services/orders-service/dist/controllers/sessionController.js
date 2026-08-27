"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionReport = exports.forceCloseSessionByCronIfNeeded = exports.forceCloseSessionByCron = exports.getSessionsHistory = exports.getCurrentSession = exports.closeSession = exports.openSession = void 0;
const db_1 = __importDefault(require("../config/db"));
const logger_1 = __importDefault(require("../config/logger"));
const openSession = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : 1;
        const storeId = req.body.store_id || req.query.store_id || 1;
        // Verificar si ya hay una abierta EN ESTA TIENDA
        const current = await db_1.default.query("SELECT id FROM sesion_caja WHERE estado = 'ABIERTA' AND store_id = $1", [storeId]);
        if (current.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe una sesión de caja abierta para esta tienda', code: 'SESSION_ALREADY_OPEN' });
        }
        const result = await db_1.default.query("INSERT INTO sesion_caja (usuario_id, estado, store_id) VALUES ($1, 'ABIERTA', $2) RETURNING *", [userId, storeId]);
        logger_1.default.info('Sesión de caja abierta manualmente', { sessionId: result.rows[0].id, userId, storeId });
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
};
exports.openSession = openSession;
const closeSession = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : 1;
        const storeId = req.body.store_id || req.query.store_id || 1;
        const current = await db_1.default.query("SELECT id FROM sesion_caja WHERE estado = 'ABIERTA' AND store_id = $1", [storeId]);
        if (current.rows.length === 0) {
            return res.status(400).json({ error: 'No hay ninguna sesión abierta en esta tienda', code: 'NO_OPEN_SESSION' });
        }
        const sessionId = current.rows[0].id;
        // Calcular total real de la sesión (sumando ventas)
        const totalVentasResult = await db_1.default.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
        const total = totalVentasResult.rows[0].total;
        const result = await db_1.default.query("UPDATE sesion_caja SET estado = 'CERRADA', hora_cierre = CURRENT_TIMESTAMP, total_ventas = $1 WHERE id = $2 RETURNING *", [total, sessionId]);
        logger_1.default.info('Sesión de caja cerrada manualmente', { sessionId, userId, total, storeId });
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
};
exports.closeSession = closeSession;
const getCurrentSession = async (req, res, next) => {
    try {
        const storeId = req.query.store_id || 1;
        const current = await db_1.default.query("SELECT * FROM sesion_caja WHERE estado = 'ABIERTA' AND store_id = $1 LIMIT 1", [storeId]);
        if (current.rows.length === 0) {
            return res.status(200).json(null); // No content
        }
        // Obtener total ventas en vivo
        const sessionId = current.rows[0].id;
        const totalVentasResult = await db_1.default.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
        current.rows[0].total_ventas_vivo = totalVentasResult.rows[0].total;
        res.json(current.rows[0]);
    }
    catch (error) {
        next(error);
    }
};
exports.getCurrentSession = getCurrentSession;
const getSessionsHistory = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0, store_id } = req.query;
        let result;
        if (store_id) {
            result = await db_1.default.query("SELECT * FROM sesion_caja WHERE store_id = $1 ORDER BY hora_apertura DESC LIMIT $2 OFFSET $3", [store_id, limit, offset]);
        }
        else {
            result = await db_1.default.query("SELECT * FROM sesion_caja ORDER BY hora_apertura DESC LIMIT $1 OFFSET $2", [limit, offset]);
        }
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
};
exports.getSessionsHistory = getSessionsHistory;
// Utilidad interna para forzar cierre cron (versión original - compatibilidad)
const forceCloseSessionByCron = async () => {
    try {
        const openSessions = await db_1.default.query("SELECT id, store_id FROM sesion_caja WHERE estado = 'ABIERTA'");
        for (const session of openSessions.rows) {
            const sessionId = session.id;
            const totalVentasResult = await db_1.default.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
            const total = totalVentasResult.rows[0].total;
            await db_1.default.query("UPDATE sesion_caja SET estado = 'CERRADA', hora_cierre = CURRENT_TIMESTAMP, total_ventas = $1 WHERE id = $2", [total, sessionId]);
            logger_1.default.info('Sesión de caja cerrada por CRON', { sessionId, storeId: session.store_id, total });
        }
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
    }
};
exports.forceCloseSessionByCron = forceCloseSessionByCron;
// Versión robusta: solo cierra si la sesión fue abierta ANTES de la hora de cierre configurada.
// Esto permite que si el servicio se reinicia después de las 3 AM, siga cerrando sesiones
// que quedaron abiertas del día/noche anterior, sin afectar sesiones nuevas abiertas hoy.
const forceCloseSessionByCronIfNeeded = async (closeTimestamp, tz) => {
    try {
        // Buscar TODAS las sesiones abiertas
        const current = await db_1.default.query("SELECT id, hora_apertura, store_id FROM sesion_caja WHERE estado = 'ABIERTA'");
        if (current.rows.length === 0)
            return; // No hay sesiones abiertas, nada que hacer
        for (const session of current.rows) {
            const sessionOpenTime = new Date(session.hora_apertura);
            // Solo cerrar si la sesión fue abierta ANTES de la hora de cierre configurada
            if (sessionOpenTime < closeTimestamp) {
                const sessionId = session.id;
                const totalVentasResult = await db_1.default.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
                const total = totalVentasResult.rows[0].total;
                await db_1.default.query("UPDATE sesion_caja SET estado = 'CERRADA', hora_cierre = CURRENT_TIMESTAMP, total_ventas = $1 WHERE id = $2", [total, sessionId]);
                logger_1.default.info('Sesión de caja cerrada por CRON (robusta)', {
                    sessionId,
                    storeId: session.store_id,
                    total,
                    sessionOpenTime: sessionOpenTime.toISOString(),
                    closeTimestamp: closeTimestamp.toISOString(),
                    tz
                });
            }
        }
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
    }
};
exports.forceCloseSessionByCronIfNeeded = forceCloseSessionByCronIfNeeded;
const getSessionReport = async (req, res, next) => {
    try {
        const sessionId = parseInt(req.params.id);
        if (isNaN(sessionId))
            return res.status(400).json({ error: 'ID de sesión inválido' });
        // Obtener datos de la sesión
        const sessionRes = await db_1.default.query('SELECT * FROM sesion_caja WHERE id = $1', [sessionId]);
        if (sessionRes.rows.length === 0) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }
        const session = sessionRes.rows[0];
        // Obtener resumen de ventas por método de pago para esta sesión
        const salesRes = await db_1.default.query(`
            SELECT COALESCE(metodopago_usu, 'Efectivo') as metodo, SUM(montofinal_vent) as total, COUNT(*) as cantidad
            FROM Ventas
            WHERE sesion_id = $1 AND estado != 'cancelada'
            GROUP BY COALESCE(metodopago_usu, 'Efectivo')
        `, [sessionId]);
        // Calcular total general para estar seguros
        const totalVentas = salesRes.rows.reduce((acc, row) => acc + Number(row.total), 0);
        res.json({
            session: {
                id: session.id,
                hora_apertura: session.hora_apertura,
                hora_cierre: session.hora_cierre,
                estado: session.estado,
                usuario_id: session.usuario_id,
                total_ventas: totalVentas // usar el calculado que es más fresco
            },
            ventas_por_metodo: salesRes.rows
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getSessionReport = getSessionReport;
