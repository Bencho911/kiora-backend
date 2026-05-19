'use strict';

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const swaggerUi  = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const env        = require('./config/env');
const logger     = require('./config/logger');

const path = require('path');

const app = express();

// ── Seguridad y parseo ───────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: false, // Permitir cargar imágenes desde otros dominios (el gateway)
}));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());

// ── Archivos estáticos (imágenes subidas localmente) ─────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
const correlationMiddleware = require('./middlewares/correlationMiddleware');
app.use(correlationMiddleware);


// ── Health-check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'products-service' }));

// ── Métricas (Prometheus) ─────────────────────────────────────────────────
const promClient = require('prom-client');
promClient.collectDefaultMetrics({ prefix: 'products_' });

// Histograma de latencia por ruta para p95/p99
const httpDuration = new promClient.Histogram({
    name: 'products_http_request_duration_seconds',
    help: 'Duración de requests HTTP en products-service',
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
    customSiteTitle: 'Kiora — Products Service',
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Rutas ─────────────────────────────────────────────────────────────────
app.use('/api/products',    require('./routes/productRoutes'));
app.use('/api/categories',  require('./routes/categoryRoutes'));

// ── Manejo global de errores ──────────────────────────────────────────────
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
