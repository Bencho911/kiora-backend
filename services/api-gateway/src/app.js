require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
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

// ── Rate Limiting Distribuido (Redis con fail-open) ───────────────────────
const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
    },
});

let redisReady = false;
redisClient.on('connect', () => { redisReady = true; logger.info('Rate limiter: Redis conectado'); });
redisClient.on('close', () => { redisReady = false; });
redisClient.on('error', (err) => { redisReady = false; logger.warn('Rate limiter: Redis error', { error: err.message }); });

redisClient.connect().catch(() => {
    logger.warn('Rate limiter: Redis no disponible — fail-open activado');
});

const redisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
    message: { error: 'Too Many Requests', code: 'RATE_LIMIT', message: 'Límite de peticiones excedido (2000/15min), intenta más tarde.' },
});

// Fail-open: si Redis no está listo, skip rate limiting
app.use('/api', (req, res, next) => {
    if (!redisReady) return next(); // fail-open: allow request
    return redisLimiter(req, res, next);
});

// ── Deprecation middleware para rutas sin versionar ───────────────────────
const deprecationMiddleware = (req, res, next) => {
    // Solo aplica a /api/* que NO sea /api/v1/* ni /api/docs*
    if (req.path.startsWith('/api/') &&
        !req.path.startsWith('/api/v1/') &&
        !req.path.startsWith('/api/docs')) {
        res.set('Deprecation', 'true');
        res.set('Sunset', '2027-01-01');
        res.set('Link', '</api/v1/>; rel="successor-version"');
        logger.debug('Deprecated route accessed', { path: req.path, method: req.method });
    }
    next();
};
app.use(deprecationMiddleware);

// ── Autenticación centralizada (JWT) ──────────────────────────────────────
app.use(authMiddleware);

// ── Swagger UI ────────────────────────────────────────────────────────────
const swaggerOptions = {
    explorer: true,
    swaggerOptions: {
        urls: [
            { url: '/api/users/docs-json', name: 'Users Service' },
            { url: '/api/docs.json?svc=products', name: 'Products Service' },
            { url: '/api/docs.json?svc=inventory', name: 'Inventory Service' },
            { url: '/api/docs.json?svc=orders', name: 'Orders Service' },
            { url: '/api/docs.json?svc=reports', name: 'Reports Service' },
        ],
    },
};
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(null, swaggerOptions));

// ── Service URLs ──────────────────────────────────────────────────────────
const services = {
    users: process.env.USERS_SERVICE_URL || 'http://localhost:3001',
    products: process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002',
    inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
    orders: process.env.ORDERS_SERVICE_URL || 'http://localhost:3004',
    notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:3005',
    reports: process.env.REPORTS_SERVICE_URL || 'http://localhost:3006',
};

// ── Swagger docs proxy ───────────────────────────────────────────────────
app.get('/api/docs.json', async (req, res) => {
    const svc = req.query.svc;
    const base = services[svc];
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

// ── Proxy factory ─────────────────────────────────────────────────────────
const onProxyError = (serviceName) => (err, req, res) => {
    logger.error(`[Proxy Error] ${serviceName}: ${err.message}`);
    res.status(503).json({
        error: 'Service Unavailable',
        code: 'SERVICE_UNAVAILABLE',
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
                if (cid) proxyReq.setHeader('x-correlation-id', cid);
            },
            error: onProxyError(serviceName),
        },
    });

/**
 * Crea un proxy que reescribe /api/v1/X → /api/X al microservicio.
 * El microservicio NO necesita saber de versiones.
 */
const v1Proxy = (serviceName, target, basePath) =>
    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { [`^/api/v1${basePath}`]: `/api${basePath}` },
        on: {
            proxyReq: (proxyReq, req) => {
                const cid = req.headers['x-correlation-id'];
                if (cid) proxyReq.setHeader('x-correlation-id', cid);
            },
            error: onProxyError(serviceName),
        },
    });

// ── Versioned routes (/api/v1/*) ──────────────────────────────────────────
app.use('/api/v1/users', v1Proxy('users-service', services.users, '/users'));
app.use('/api/v1/auth', v1Proxy('users-service', services.users, '/auth'));
app.use('/api/v1/products', v1Proxy('products-service', services.products, '/products'));
app.use('/api/v1/categories', v1Proxy('products-service', services.products, '/categories'));
app.use('/api/v1/inventory', v1Proxy('inventory-service', services.inventory, '/inventory'));
app.use('/api/v1/orders', v1Proxy('orders-service', services.orders, '/orders'));
app.use('/api/v1/invoices', v1Proxy('orders-service', services.orders, '/invoices'));
app.use('/api/v1/notifications', v1Proxy('notifications-service', services.notifications, '/notifications'));
app.use('/api/v1/reports', v1Proxy('reports-service', services.reports, '/reports'));

// ── Legacy routes (/api/*) — backwards compatible, with deprecation header ─
app.use('/api/users', transparentProxy('users-service', services.users));
app.use('/api/auth', transparentProxy('users-service', services.users));
app.use('/api/products', transparentProxy('products-service', services.products));
app.use('/api/categories', transparentProxy('products-service', services.products));
app.use('/api/inventory', transparentProxy('inventory-service', services.inventory));
app.use('/api/orders', transparentProxy('orders-service', services.orders));
app.use('/api/invoices', transparentProxy('orders-service', services.orders));
app.use('/api/notifications', transparentProxy('notifications-service', services.notifications));
app.use('/api/reports', transparentProxy('reports-service', services.reports));

// ── Health checks ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'API Gateway is running' });
});

// ── Métricas (Prometheus) ─────────────────────────────────────────────────
const promClient = require('prom-client');
promClient.collectDefaultMetrics({ prefix: 'gateway_' });
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

const serviceHealthPaths = {
    users: `${services.users}/api/users/health`,
    products: `${services.products}/health`,
    inventory: `${services.inventory}/health`,
    orders: `${services.orders}/health`,
    notifications: `${services.notifications}/health`,
    reports: `${services.reports}/api/reports/health`,
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

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    logger.error('API Gateway Error', { message: err.message });
    res.status(500).json({ error: 'Internal Server Error', code: 'GATEWAY_ERROR', message: 'Gateway panic' });
});

module.exports = app;
