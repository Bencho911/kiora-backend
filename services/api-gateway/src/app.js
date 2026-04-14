require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const logger = require('./config/logger');

const correlationId = require('./middleware/correlationId');
const authMiddleware = require('./middleware/auth');

const app = express();

// ── Configuración de Seguridad y Middlewares Globales ──────────────────────
app.use(helmet());

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
}));

app.use(morgan('dev'));
app.use(cookieParser());

app.use(correlationId);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    message: { error: 'Too Many Requests', message: 'Límite de peticiones excedido (2000/15min), intenta más tarde.' },
});
app.use('/api', limiter);

// ── Autenticación centralizada (JWT) ──────────────────────────────────────
// Valida el token antes de proxificar a los microservicios.
// Las rutas públicas se definen en middleware/auth.js → PUBLIC_PREFIXES.
app.use(authMiddleware);

const swaggerOptions = {
    explorer: true,
    swaggerOptions: {
        urls: [
            { url: '/api/users/docs-json', name: 'Users Service' },
            { url: '/api/docs.json?svc=products', name: 'Products Service' },
            { url: '/api/docs.json?svc=inventory', name: 'Inventory Service' },
            { url: '/api/docs.json?svc=orders', name: 'Orders Service' },
        ],
    },
};
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(null, swaggerOptions));

const SERVICES_URLS = {
    products: process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002',
    inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
    orders: process.env.ORDERS_SERVICE_URL || 'http://localhost:3004',
};

app.get('/api/docs.json', async (req, res) => {
    const svc = req.query.svc;
    const base = SERVICES_URLS[svc];
    if (!base) return res.status(400).json({ error: 'svc param must be products, inventory or orders' });
    try {
        const r = await fetch(`${base}/api/docs.json`);
        const json = await r.json();
        res.json(json);
    } catch (err) {
        logger.warn(`No se pudo obtener docs de ${svc}`, { error: err.message });
        res.status(503).json({ error: `${svc} service unavailable` });
    }
});

const services = {
    users: process.env.USERS_SERVICE_URL || 'http://localhost:3001',
    products: process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002',
    inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
    orders: process.env.ORDERS_SERVICE_URL || 'http://localhost:3004',
    notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:3005',
};

const onProxyError = (serviceName) => (err, req, res) => {
    logger.error(`[Proxy Error] ${serviceName}: ${err.message}`);
    res.status(503).json({
        error: 'Service Unavailable',
        service: serviceName,
        message: 'El microservicio no está disponible en este momento.',
    });
};

const transparentProxy = (serviceName, target) =>
    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: (path, req) => req.originalUrl,
        on: {
            proxyReq: (proxyReq, req) => {
                const cid = req.headers['x-correlation-id'];
                if (cid) {
                    proxyReq.setHeader('x-correlation-id', cid);
                }
            },
            error: onProxyError(serviceName),
        },
    });

app.use('/api/users', transparentProxy('users-service', services.users));
app.use('/api/auth', transparentProxy('users-service', services.users));
app.use('/api/products', transparentProxy('products-service', services.products));
app.use('/api/categories', transparentProxy('products-service', services.products));
app.use('/api/inventory', transparentProxy('inventory-service', services.inventory));
app.use('/api/orders', transparentProxy('orders-service', services.orders));
app.use('/api/invoices', transparentProxy('orders-service', services.orders));
app.use('/api/notifications', transparentProxy('notifications-service', services.notifications));

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'API Gateway is running' });
});

const serviceHealthPaths = {
    users: `${services.users}/api/users/health`,
    products: `${services.products}/health`,
    inventory: `${services.inventory}/health`,
    orders: `${services.orders}/health`,
    notifications: `${services.notifications}/health`,
};

app.get('/health/all', async (_req, res) => {
    const results = {};

    await Promise.all(
        Object.entries(serviceHealthPaths).map(async ([name, healthUrl]) => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const response = await fetch(healthUrl, { signal: controller.signal });
                clearTimeout(timeout);
                results[name] = { status: response.ok ? 'up' : 'down', statusCode: response.status };
            } catch (err) {
                results[name] = { status: 'down', error: err.message };
            }
        })
    );

    const allUp = Object.values(results).every((r) => r.status === 'up');
    res.status(allUp ? 200 : 503).json({
        gateway: 'up',
        services: results,
    });
});

app.use((err, _req, res, _next) => {
    logger.error('API Gateway Error', { message: err.message });
    res.status(500).json({ error: 'Internal Server Error', message: 'Gateway panic' });
});

module.exports = app;
