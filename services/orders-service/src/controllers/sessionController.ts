import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import logger from '../config/logger';


export const openSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req.headers['x-user-id'] as string) ? parseInt((req.headers['x-user-id'] as string)) : 1;
        const storeId = req.body.store_id || req.query.store_id || 1;
        
        // Verificar si ya hay una abierta EN ESTA TIENDA
        const current = await pool.query("SELECT id FROM sesion_caja WHERE estado = 'ABIERTA' AND store_id = $1", [storeId]);
        if (current.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe una sesión de caja abierta para esta tienda', code: 'SESSION_ALREADY_OPEN' });
        }

        const result = await pool.query(
            "INSERT INTO sesion_caja (usuario_id, estado, store_id) VALUES ($1, 'ABIERTA', $2) RETURNING *",
            [userId, storeId]
        );
        
        logger.info('Sesión de caja abierta manualmente', { sessionId: result.rows[0].id, userId, storeId });
        res.status(201).json(result.rows[0]);
    } catch (error: unknown) {
        next(error);
    }
};

export const closeSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req.headers['x-user-id'] as string) ? parseInt((req.headers['x-user-id'] as string)) : 1;
        const storeId = req.body.store_id || req.query.store_id || 1;
        const current = await pool.query("SELECT id FROM sesion_caja WHERE estado = 'ABIERTA' AND store_id = $1", [storeId]);
        
        if (current.rows.length === 0) {
            return res.status(400).json({ error: 'No hay ninguna sesión abierta en esta tienda', code: 'NO_OPEN_SESSION' });
        }
        
        const sessionId = current.rows[0].id;

        // Calcular total real de la sesión (sumando ventas)
        const totalVentasResult = await pool.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
        const total = totalVentasResult.rows[0].total;

        const result = await pool.query(
            "UPDATE sesion_caja SET estado = 'CERRADA', hora_cierre = CURRENT_TIMESTAMP, total_ventas = $1 WHERE id = $2 RETURNING *",
            [total, sessionId]
        );
        
        logger.info('Sesión de caja cerrada manualmente', { sessionId, userId, total, storeId });

        res.json(result.rows[0]);
    } catch (error: unknown) {
        next(error);
    }
};

export const getCurrentSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const storeId = req.query.store_id || 1;
        const current = await pool.query("SELECT * FROM sesion_caja WHERE estado = 'ABIERTA' AND store_id = $1 LIMIT 1", [storeId]);
        if (current.rows.length === 0) {
            return res.status(200).json(null); // No content
        }

        // Obtener total ventas en vivo
        const sessionId = current.rows[0].id;
        const totalVentasResult = await pool.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
        current.rows[0].total_ventas_vivo = totalVentasResult.rows[0].total;
        
        res.json(current.rows[0]);
    } catch (error: unknown) {
        next(error);
    }
};

export const getSessionsHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { limit = 20, offset = 0, store_id } = req.query;
        let result;
        if (store_id) {
            result = await pool.query("SELECT * FROM sesion_caja WHERE store_id = $1 ORDER BY hora_apertura DESC LIMIT $2 OFFSET $3", [store_id, limit, offset]);
        } else {
            result = await pool.query("SELECT * FROM sesion_caja ORDER BY hora_apertura DESC LIMIT $1 OFFSET $2", [limit, offset]);
        }
        res.json(result.rows);
    } catch (error: unknown) {
        next(error);
    }
};

// Utilidad interna para forzar cierre cron (versión original - compatibilidad)
export const forceCloseSessionByCron = async () => {
    try {
        const openSessions = await pool.query("SELECT id, store_id FROM sesion_caja WHERE estado = 'ABIERTA'");
        for (const session of openSessions.rows) {
            const sessionId = session.id;
            const totalVentasResult = await pool.query("SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'", [sessionId]);
            const total = totalVentasResult.rows[0].total;
            
            await pool.query(
                "UPDATE sesion_caja SET estado = 'CERRADA', hora_cierre = CURRENT_TIMESTAMP, total_ventas = $1 WHERE id = $2",
                [total, sessionId]
            );
            logger.info('Sesión de caja cerrada por CRON', { sessionId, storeId: session.store_id, total });
        }
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
    }
};

// Versión robusta: solo cierra si la sesión fue abierta ANTES de la hora de cierre configurada.
// Esto permite que si el servicio se reinicia después de las 3 AM, siga cerrando sesiones
// que quedaron abiertas del día/noche anterior, sin afectar sesiones nuevas abiertas hoy.
export const forceCloseSessionByCronIfNeeded = async (closeTimestamp: Date, tz: string) => {
    try {
        // Buscar TODAS las sesiones abiertas
        const current = await pool.query(
            "SELECT id, hora_apertura, store_id FROM sesion_caja WHERE estado = 'ABIERTA'"
        );

        if (current.rows.length === 0) return; // No hay sesiones abiertas, nada que hacer

        for (const session of current.rows) {
            const sessionOpenTime = new Date(session.hora_apertura);

            // Solo cerrar si la sesión fue abierta ANTES de la hora de cierre configurada
            if (sessionOpenTime < closeTimestamp) {
                const sessionId = session.id;
                const totalVentasResult = await pool.query(
                    "SELECT COALESCE(SUM(montofinal_vent), 0) as total FROM Ventas WHERE sesion_id = $1 AND estado != 'cancelada'",
                    [sessionId]
                );
                const total = totalVentasResult.rows[0].total;

                await pool.query(
                    "UPDATE sesion_caja SET estado = 'CERRADA', hora_cierre = CURRENT_TIMESTAMP, total_ventas = $1 WHERE id = $2",
                    [total, sessionId]
                );
                logger.info('Sesión de caja cerrada por CRON (robusta)', {
                    sessionId,
                    storeId: session.store_id,
                    total,
                    sessionOpenTime: sessionOpenTime.toISOString(),
                    closeTimestamp: closeTimestamp.toISOString(),
                    tz
                });
            }
        }
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
    }
};

export const getSessionReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = parseInt(req.params.id as string);
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
        const totalVentas = salesRes.rows.reduce((acc: number, row: any) => acc + Number(row.total), 0);

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
    } catch (error: unknown) {
        next(error);
    }
};
