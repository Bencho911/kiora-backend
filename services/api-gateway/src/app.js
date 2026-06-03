require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
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
const auditMiddleware = require('./middleware/auditMiddleware');

const app = express();

// ── Configuración de Seguridad y Middlewares Globales ──────────────────────
app.use(helmet({
    contentSecurityPolicy: false,
}));

const ALLOWED_ORIGINS = new Set(
    (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim())
);

function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-client-type');
        res.setHeader('Vary', 'Origin');
    }
}

// Middleware CORS manual: se ejecuta antes y después del proxy
// (los servicios downstream tienen su propio CORS con localhost:3000
// y el proxy pasa esos headers, necesitamos sobrescribirlos)
app.use((req, res, next) => {
    setCorsHeaders(req, res);
    const origWriteHead = res.writeHead;
    res.writeHead = function (...args) {
        setCorsHeaders(req, res);
        return origWriteHead.apply(this, args);
    };
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.use(morgan('dev'));
app.use(cookieParser());

app.use(correlationId);

// ── Rate Limiting Distribuido (Redis con fail-open) ───────────────────────
let redisReady = false;
let redisClient;

if (process.env.NODE_ENV !== 'test') {
    redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: null,  // null = no lanzar MaxRetriesPerRequestError (evita crash)
        connectTimeout: 3000,
        retryStrategy(times) {
            if (times > 5) return null; // dejar de reintentar tras 5 intentos
            return Math.min(times * 500, 3000);
        },
    });

    redisClient.on('connect', () => { redisReady = true; logger.info('Rate limiter: Redis conectado'); });
    redisClient.on('close', () => { redisReady = false; });
    redisClient.on('error', (err) => { redisReady = false; logger.warn('Rate limiter: Redis error', { error: err.message }); });

    redisClient.connect().catch(() => {
        logger.warn('Rate limiter: Redis no disponible — fail-open activado');
    });
}

const redisLimiter = redisClient ? rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
    message: { error: 'Too Many Requests', code: 'RATE_LIMIT', message: 'Límite de peticiones excedido (2000/15min), intenta más tarde.' },
}) : null;

// Fail-open: si Redis no está listo, skip rate limiting
app.use('/api', (req, res, next) => {
    if (!redisReady || !redisLimiter) return next(); // fail-open: allow request
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

// ── Service URLs ──────────────────────────────────────────────────────────
const services = {
    users: process.env.USERS_SERVICE_URL || 'http://localhost:3001',
    products: process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002',
    inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
    orders: process.env.ORDERS_SERVICE_URL || 'http://localhost:3004',
    notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:3005',
    reports: process.env.REPORTS_SERVICE_URL || 'http://localhost:3006',
    activity: process.env.ACTIVITY_SERVICE_URL || 'http://localhost:3007',
    ai: process.env.AI_SERVICE_URL || 'http://localhost:3008',
};

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

app.use(createProxyMiddleware({
    pathFilter: '/api/public/products',
    target: services.products,
    changeOrigin: true,
    pathRewrite: { '^/api/public/products': '/api/products' },
    on: { error: onProxyError('products-service (public)') },
}));
app.use(createProxyMiddleware({
    pathFilter: '/api/public/categories',
    target: services.products,
    changeOrigin: true,
    pathRewrite: { '^/api/public/categories': '/api/categories' },
    on: { error: onProxyError('products-service (public)') },
}));

// ── Autenticación centralizada (JWT) ──────────────────────────────────────
app.use(authMiddleware);

// ── Audit log de acciones admin ───────────────────────────────────────────
app.use(auditMiddleware);

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
            { url: '/api/docs.json?svc=notifications', name: 'Notifications Service' },
            { url: '/api/docs.json?svc=ai', name: 'AI Service' },
        ],
    },
};
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(null, swaggerOptions));

// ── Swagger docs proxy ───────────────────────────────────────────────────
app.get('/api/docs.json', async (req, res) => {
    const svc = req.query.svc;
    const base = services[svc];
    if (!base) return res.status(400).json({ error: 'svc param must be products, inventory, orders, notifications or reports' });
    try {
        const r = await fetch(`${base}/api/docs.json`);
        const json = await r.json();
        res.json(json);
    } catch (err) {
        logger.warn(`No se pudo obtener docs de ${svc}`, { error: err.message });
        res.status(503).json({ error: `${svc} service unavailable` });
    }
});

/**
 * Crea un proxy que reescribe /api/v1/X → /api/X al microservicio.
 * El microservicio NO necesita saber de versiones.
 *
 * Nota: pathRewrite usa función con req.originalUrl porque http-proxy-middleware
 * v3 recibe el path sin el prefijo de montaje de Express (req.url).
 * Usar un objeto regex no funca porque el regex se aplica contra el path recortado.
 */
const v1Proxy = (serviceName, target, basePath) =>
    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: (path, req) =>
            req.originalUrl.replace(`/api/v1${basePath}`, `/api${basePath}`),
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
app.use('/api/v1/activity-logs', v1Proxy('activity-service', services.activity, '/activity-logs'));
app.use('/api/v1/incidents', v1Proxy('users-service', services.users, '/incidents'));
app.use('/api/v1/ai', v1Proxy('ai-service', services.ai, '/ai'));

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
app.use('/api/activity-logs', transparentProxy('activity-service', services.activity));
app.use('/api/incidents', transparentProxy('users-service', services.users));

// AI routes
app.use('/api/ai', transparentProxy('ai-service', services.ai));

// ── Imágenes subidas (proxy a products-service) ──────────────────────────
app.use('/uploads', transparentProxy('products-service', services.products));

// ── Health checks ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'API Gateway is running' });
});

// ── Dashboard stats (ventas en tiempo real) — delegate a orders-service ───
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const statsRes = await fetch(`${services.orders}/api/orders/stats`);
        if (!statsRes.ok) {
            logger.warn('Stats endpoint fallo, fallback a orders list', { status: statsRes.status });
            return res.status(503).json({ error: 'No se pudieron obtener estadísticas' });
        }
        const data = await statsRes.json();
        res.json(data);
    } catch (err) {
        logger.error('Error obteniendo stats del dashboard', { error: err.message });
        res.status(503).json({ error: 'No se pudieron obtener estadísticas' });
    }
});

// ── Webhook interno para emisión de WebSockets ────────────────────────────
// Los microservicios llaman a este endpoint interno para notificar eventos al frontend
app.post('/api/internal/broadcast', (req, res) => {
    const { event, payload } = req.body || {};
    if (event && app.locals.io) {
        app.locals.io.emit(event, payload);
        res.status(200).json({ ok: true, broadcasted: true });
    } else {
        res.status(400).json({ error: 'Falta event name o Socket.IO no está listo' });
    }
});

// ── Métricas (Prometheus) ─────────────────────────────────────────────────
const promClient = require('prom-client');
if (process.env.NODE_ENV !== 'test') {
    promClient.collectDefaultMetrics({ prefix: 'gateway_' });
}
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
    activity: `${services.activity}/health`,
    ai: `${services.ai}/health`,
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
