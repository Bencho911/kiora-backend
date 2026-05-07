'use strict';

const express = require('express');
const helmet  = require('helmet');
const logger  = require('./config/logger');
const env     = require('./config/env');

const app = express();

app.use(helmet());
app.use(express.json());

// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
const correlationMiddleware = require('./middlewares/correlationMiddleware');
app.use(correlationMiddleware);

// ── Rutas ─────────────────────────────────────────────────────────────────
const alertRoutes = require('./routes/alertRoutes');
app.use('/api/notifications/alerts', alertRoutes);

// ── Swagger ───────────────────────────────────────────────────────────────
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Health-check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
    status: 'ok',
    service: 'notifications-service',
    redis: { host: env.redis.host, port: env.redis.port },
}));

// ── Readiness (verifica conectividad con Redis) ───────────────────────────
const Redis = require('ioredis');
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

module.exports = app;
