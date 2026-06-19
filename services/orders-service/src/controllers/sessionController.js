const pool = require('../config/db');
const logger = require('../config/logger');
const axios = require('axios'); // Para consultar settings-service (users-service)

// Helper para obtener configuración global
const getSettings = async (token) => {
    try {
        const usersUrl = process.env.USERS_SERVICE_URL || 'http://users-service:3001';
        const res = await axios.get(`${usersUrl}/api/settings/internal`);
        return res.data;
    } catch (error) {
        logger.error('Error obteniendo ajustes', { error: error.message });
        return { cierre_caja_automatico: true, hora_cierre_automatico: '03:00', abrir_siguiente_automatico: false };
    }
};

const openSession = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : 1;
        
        // Verificar si ya hay una abierta
        const current = await pool.query("SELECT id FROM sesion_caja WHERE estado = 'ABIERTA'");
        if (current.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe una sesión de caja abierta', code: 'SESSION_ALREADY_OPEN' });
        }

        const result = await pool.query(
            "INSERT INTO sesion_caja (usuario_id, estado) VALUES ($1, 'ABIERTA') RETURNING *",
            [userId]
        );
        
        logger.info('Sesión de caja abierta manualmente', { sessionId: result.rows[0].id, userId });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

const closeSession = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : 1;
        const current = await pool.query("SELECT id FROM sesion_caja WHERE estado = 'ABIERTA'");
        
        if (current.rows.length === 0) {
            return res.status(400).json({ error: 'No hay ninguna sesión abierta', code: 'NO_OPEN_SESSION' });
        }
        
        const sessionId = current.rows[0].id;

        // Calcular total real de la sesión (sumando ventas)
        const totalVentasResult = await pool.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
        const total = totalVentasResult.rows[0].total;

        const result = await pool.query(
            "UPDATE sesion_caja SET estado = 'CERRADA', hora_cierre = CURRENT_TIMESTAMP, total_ventas = $1 WHERE id = $2 RETURNING *",
            [total, sessionId]
        );
        
        logger.info('Sesión de caja cerrada manualmente', { sessionId, userId, total });

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

const getCurrentSession = async (req, res, next) => {
    try {
        const current = await pool.query("SELECT * FROM sesion_caja WHERE estado = 'ABIERTA' LIMIT 1");
        if (current.rows.length === 0) {
            return res.status(200).json(null); // No content
        }

        // Obtener total ventas en vivo
        const sessionId = current.rows[0].id;
        const totalVentasResult = await pool.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
        current.rows[0].total_ventas_vivo = totalVentasResult.rows[0].total;
        
        res.json(current.rows[0]);
    } catch (error) {
        next(error);
    }
};

const getSessionsHistory = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const result = await pool.query("SELECT * FROM sesion_caja ORDER BY hora_apertura DESC LIMIT $1 OFFSET $2", [limit, offset]);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
};

// Utilidad interna para forzar cierre cron
const forceCloseSessionByCron = async () => {
    try {
        const current = await pool.query("SELECT id FROM sesion_caja WHERE estado = 'ABIERTA'");
        if (current.rows.length > 0) {
            const sessionId = current.rows[0].id;
            const totalVentasResult = await pool.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
            const total = totalVentasResult.rows[0].total;
            
            await pool.query(
                "UPDATE sesion_caja SET estado = 'CERRADA', hora_cierre = CURRENT_TIMESTAMP, total_ventas = $1 WHERE id = $2",
                [total, sessionId]
            );
            logger.info('Sesión de caja cerrada por CRON', { sessionId, total });
        }
    } catch (error) {
        logger.error('Error en forceCloseSessionByCron', { error: error.message });
    }
};

const getSessionReport = async (req, res, next) => {
    try {
        const sessionId = parseInt(req.params.id);
        if (isNaN(sessionId)) return res.status(400).json({ error: 'ID de sesión inválido' });

        // Obtener datos de la sesión
        const sessionRes = await pool.query('SELECT * FROM sesion_caja WHERE id = $1', [sessionId]);
        if (sessionRes.rows.length === 0) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }
        const session = sessionRes.rows[0];

        // Obtener resumen de ventas por método de pago para esta sesión
        const salesRes = await pool.query(`
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
    } catch (error) {
        next(error);
    }
};

module.exports = {
    openSession,
    closeSession,
    getCurrentSession,
    getSessionsHistory,
    forceCloseSessionByCron,
    getSessionReport
};
