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

// ── Webhooks de Stripe (Debe capturar el raw buffer antes de procesar JSON) ──
const { handleStripeWebhook } = require('./controllers/paymentController');
app.post(
    '/api/orders/checkout/webhook',
    express.raw({ type: 'application/json' }),
    handleStripeWebhook
);

// Body parser global para el resto de rutas
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'orders-service' }));

// ── Métricas (Prometheus) ─────────────────────────────────────────────────
const promClient = require('prom-client');
promClient.collectDefaultMetrics({ prefix: 'orders_' });
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
    customSiteTitle: 'Kiora — Orders Service',
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Rutas ─────────────────────────────────────────────────────────────────
// IMPORTANTE: invoices debe ir ANTES de /:id para evitar conflicto de rutas
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/orders/checkout', require('./routes/paymentRoutes'));
app.use('/api/orders/export',   require('./routes/exportRoutes'));
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
