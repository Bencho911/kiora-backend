'use strict';

import express from 'express';
import helmet from 'helmet';
import logger from './config/logger.js';
import env from './config/env.js';

const app = express();

app.use(helmet());
app.use(express.json());

// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
import correlationMiddleware from './middlewares/correlationMiddleware.js';
app.use(correlationMiddleware);

// ── Rutas ─────────────────────────────────────────────────────────────────
import alertRoutes from './routes/alertRoutes.js';
app.use('/api/notifications/alerts', alertRoutes);

// ── Swagger ───────────────────────────────────────────────────────────────
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Health-check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
    status: 'ok',
    service: 'notifications-service',
    redis: { host: env.redis.host, port: env.redis.port },
}));

// ── Readiness (verifica conectividad con Redis) ───────────────────────────
import Redis from 'ioredis';
const readinessClient = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
});
app.get('/health/ready', async (_req, res) => {
    try {
        await readinessClient.ping();
        res.status(200).json({ status: 'ready', checks: { redis: true } });
    } catch (err) {
        logger.warn('Readiness check falló', { error: err.message });
        res.status(503).json({ status: 'not_ready', error: 'Redis no responde.' });
    }
});

// ── Manejo global de errores ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    logger.error('Error no controlado', { message: err.message });
    res.status(err.status || 500).json({
        error: err.status ? err.message : 'Error interno del servidor.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    });
});

export default app;
