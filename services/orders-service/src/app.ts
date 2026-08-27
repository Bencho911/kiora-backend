import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import env from './config/env';
import logger from './config/logger';
import correlationMiddleware from './middlewares/correlationMiddleware';
import promClient from 'prom-client';
import pool from './config/db';

import invoiceRoutes from './routes/invoiceRoutes';
import paymentRoutes from './routes/paymentRoutes';
import exportRoutes from './routes/exportRoutes';
import settlementRoutes from './routes/settlementRoutes';
import sessionRoutes from './routes/sessionRoutes';
import orderRoutes from './routes/orderRoutes';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));

// Body parser global para el resto de rutas
app.use(express.json());

// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
app.use(correlationMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'orders-service' }));

// ── Métricas (Prometheus) ─────────────────────────────────────────────────
promClient.collectDefaultMetrics({ prefix: 'orders_' });

// Histograma de latencia por ruta para p95/p99
const httpDuration = new promClient.Histogram({
    name: 'orders_http_request_duration_seconds',
    help: 'Duración de requests HTTP en orders-service',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
        end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
    });
    next();
});

app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

// ── Readiness (verifica conectividad con PostgreSQL) ──────────────────────
app.get('/health/ready', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'ready', checks: { postgres: true } });
    } catch (err: unknown) {
        logger.warn('Readiness check falló', { error: (err as Error).message });
        res.status(503).json({ status: 'not_ready', error: 'PostgreSQL no responde.' });
    }
});

// ── Documentación Swagger ─────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Kiora — Orders Service',
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Rutas ─────────────────────────────────────────────────────────────────
// IMPORTANTE: invoices y settlement deben ir ANTES de /:id para evitar conflicto de rutas
app.use('/api/invoices', invoiceRoutes);
app.use('/api/orders/checkout', paymentRoutes);
app.use('/api/orders/export', exportRoutes);
app.use('/api/orders/settlement', settlementRoutes);
app.use('/api/orders/sessions', sessionRoutes);
app.use('/api/orders', orderRoutes);

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
