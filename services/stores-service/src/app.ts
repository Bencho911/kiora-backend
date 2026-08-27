import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import logger from './config/logger';
import { correlationMiddleware } from './middlewares/correlationMiddleware';
import promClient from 'prom-client';
import db from './config/db';

import regionRoutes from './routes/regionRoutes';
import ciudadRoutes from './routes/ciudadRoutes';
import storeRoutes from './routes/storeRoutes';

const app = express();

// ── Seguridad y parseo ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => callback(null, origin || '*'),
    credentials: true,
}));
app.use(express.json());

// ── Correlation ID ────────────────────────────────────────────────────────
app.use(correlationMiddleware);

// ── Health-check ──────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', service: 'stores-service' }));

// ── Métricas (Prometheus) ─────────────────────────────────────────────────
promClient.collectDefaultMetrics({ prefix: 'stores_' });

const httpDuration = new promClient.Histogram({
    name: 'stores_http_request_duration_seconds',
    help: 'Duración de requests HTTP en stores-service',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

app.use((req: Request, res: Response, next: NextFunction) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
        end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
    });
    next();
});

app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

// ── Readiness (verifica conectividad con PostgreSQL) ──────────────────────
app.get('/health/ready', async (_req: Request, res: Response) => {
    try {
        await db.query('SELECT 1');
        res.status(200).json({ status: 'ready', checks: { postgres: true } });
    } catch (err: unknown) {
        logger.warn('Readiness check falló', { error: (err as Error).message });
        res.status(503).json({ status: 'not_ready', error: 'PostgreSQL no responde.' });
    }
});

// ── Rutas ─────────────────────────────────────────────────────────────────
app.use('/api/stores/regiones', regionRoutes);
app.use('/api/stores/ciudades', ciudadRoutes);
app.use('/api/stores', storeRoutes);

// ── Manejo global de errores ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Error no controlado', { message: (err as Error).message, stack: (err as Error).stack });
    res.status((err as any).status || 500).json({
        error: (err as any).status ? (err as Error).message : 'Error interno del servidor.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { stack: (err as Error).stack } : undefined,
    });
});

export default app;
