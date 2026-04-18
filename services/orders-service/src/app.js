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

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'orders-service' }));

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
    customSiteTitle: 'Kiora — Orders Service',
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Rutas ─────────────────────────────────────────────────────────────────
// IMPORTANTE: invoices debe ir ANTES de /:id para evitar conflicto de rutas
app.use('/api/orders/invoices', require('./routes/invoiceRoutes'));
app.use('/api/orders',          require('./routes/orderRoutes'));

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
