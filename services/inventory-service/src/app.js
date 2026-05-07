'use strict';

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const env         = require('./config/env');
const logger      = require('./config/logger');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());

// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
const correlationMiddleware = require('./middlewares/correlationMiddleware');
app.use(correlationMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'inventory-service' }));

// ── Métricas (Prometheus) ─────────────────────────────────────────────────
const promClient = require('prom-client');
promClient.collectDefaultMetrics({ prefix: 'inventory_' });

// Histograma de latencia por ruta para p95/p99
const httpDuration = new promClient.Histogram({
    name: 'inventory_http_request_duration_seconds',
    help: 'Duración de requests HTTP en inventory-service',
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
const db = require('./config/db');
app.get('/health/ready', async (_req, res) => {
    try {
        await db.query('SELECT 1');
        res.status(200).json({ status: 'ready', checks: { postgres: true } });
    } catch (err) {
        logger.warn('Readiness check falló', { error: err.message });
        res.status(503).json({ status: 'not_ready', error: 'PostgreSQL no responde.' });
    }
});

// ── Documentación Swagger ─────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Kiora — Inventory Service',
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Rutas ─────────────────────────────────────────────────────────────────
app.use('/api/inventory/saga', require('./routes/reservationRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    logger.error('Error no controlado', { message: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        error: err.status ? err.message : 'Error interno del servidor.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    });
});

module.exports = app;
