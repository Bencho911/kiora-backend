import { Router, Request, Response } from 'express';
import express from 'express';
import { services } from '../config/services';
import { logger } from '@kiora/shared';

const internalRouter = Router();

// ── Dashboard stats (delegate a orders-service) ───────────────────────────
internalRouter.get(['/api/dashboard/stats', '/api/v1/dashboard/stats'], async (req: Request, res: Response) => {
    try {
        const url = new URL(`${services.orders}/api/orders/stats`);
        if (req.query.period) url.searchParams.append('period', req.query.period as string);
        if (req.query.fecha) url.searchParams.append('fecha', req.query.fecha as string);

        const statsRes = await fetch(url.toString(), {
            headers: {
                'x-user-id': req.headers['x-user-id'] as string || '',
                'x-user-role': req.headers['x-user-role'] as string || '',
                'x-allowed-stores': req.headers['x-allowed-stores'] as string || '',
                'authorization': req.headers.authorization || ''
            }
        });
        if (!statsRes.ok) {
            logger.warn('Stats endpoint fallo, fallback a orders list', { status: statsRes.status });
            res.status(503).json({ error: 'No se pudieron obtener estadísticas' });
            return;
        }
        const data = await statsRes.json();
        res.json(data);
    } catch (err: any) {
        logger.error('Error obteniendo stats del dashboard', { error: err.message });
        res.status(503).json({ error: 'No se pudieron obtener estadísticas' });
    }
});

// ── Webhook interno para emisión de WebSockets ────────────────────────────
internalRouter.post('/api/internal/broadcast', express.json(), (req: Request, res: Response) => {
    const { event, payload } = req.body || {};
    if (event && req.app.locals.io) {
        req.app.locals.io.emit(event, payload);
        res.status(200).json({ ok: true, broadcasted: true });
    } else {
        res.status(400).json({ error: 'Falta event name o Socket.IO no está listo' });
    }
});

export default internalRouter;
