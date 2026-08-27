"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = require("rate-limit-redis");
const ioredis_1 = __importDefault(require("ioredis"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const logger_1 = __importDefault(require("./config/logger"));
const correlationId_1 = require("./middleware/correlationId");
const auth_1 = require("./middleware/auth");
const auditMiddleware_1 = require("./middleware/auditMiddleware");
const prom_client_1 = __importDefault(require("prom-client"));
const app = (0, express_1.default)();
// ── Configuración de Seguridad y Middlewares Globales ──────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
}));
const ALLOWED_ORIGINS = new Set((process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim()));
// Middleware CORS manual: se ejecuta antes y después del proxy
app.use((req, res, next) => {
    const reqOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-client-type, Accept');
    if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }
    next();
});
// Helper to inject CORS into proxyRes
function injectCors(proxyRes, req) {
    const reqOrigin = req.headers.origin;
    if (reqOrigin) {
        proxyRes.headers['access-control-allow-origin'] = reqOrigin;
        proxyRes.headers['access-control-allow-credentials'] = 'true';
        proxyRes.headers['vary'] = 'Origin';
    }
}
app.use((0, morgan_1.default)('dev'));
app.use((0, cookie_parser_1.default)());
app.use(correlationId_1.correlationId);
// ── Rate Limiting Distribuido (Redis con fail-open) ───────────────────────
let redisReady = false;
let redisClient;
if (process.env.NODE_ENV !== 'test') {
    redisClient = new ioredis_1.default({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: null,
        connectTimeout: 3000,
        retryStrategy(times) {
            if (times > 5)
                return null;
            return Math.min(times * 500, 3000);
        },
    });
    redisClient.on('connect', () => { redisReady = true; logger_1.default.info('Rate limiter: Redis conectado'); });
    redisClient.on('close', () => { redisReady = false; });
    redisClient.on('error', (err) => { redisReady = false; logger_1.default.warn('Rate limiter: Redis error', { error: err.message }); });
    redisClient.connect().catch(() => {
        logger_1.default.warn('Rate limiter: Redis no disponible — fail-open activado');
    });
}
const redisLimiter = redisClient ? (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    store: new rate_limit_redis_1.RedisStore({
        sendCommand: (...args) => redisClient.call(args[0], ...args.slice(1)),
    }),
    message: { error: 'Too Many Requests', code: 'RATE_LIMIT', message: 'Límite de peticiones excedido (2000/15min), intenta más tarde.' },
}) : null;
// Fail-open: si Redis no está listo, skip rate limiting
app.use('/api', (req, res, next) => {
    if (!redisReady || !redisLimiter)
        return next();
    return redisLimiter(req, res, next);
});
// ── Deprecation middleware para rutas sin versionar ───────────────────────
const deprecationMiddleware = (req, res, next) => {
    if (req.path.startsWith('/api/') &&
        !req.path.startsWith('/api/v1/') &&
        !req.path.startsWith('/api/docs')) {
        res.set('Deprecation', 'true');
        res.set('Sunset', '2027-01-01');
        res.set('Link', '</api/v1/>; rel="successor-version"');
        logger_1.default.debug('Deprecated route accessed', { path: req.path, method: req.method });
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
    stores: process.env.STORES_SERVICE_URL || 'http://localhost:3009',
};
// ── Proxy factory ─────────────────────────────────────────────────────────
const onProxyError = (serviceName) => (err, req, res) => {
    logger_1.default.error(`[Proxy Error] ${serviceName}: ${err.message}`);
    res.status(503).json({
        error: 'Service Unavailable',
        code: 'SERVICE_UNAVAILABLE',
        service: serviceName,
        message: 'El microservicio no está disponible en este momento.',
    });
};
const transparentProxy = (serviceName, target) => (0, http_proxy_middleware_1.createProxyMiddleware)({
    target,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
        proxyReq: (proxyReq, req) => {
            const cid = req.headers['x-correlation-id'];
            if (cid)
                proxyReq.setHeader('x-correlation-id', cid);
        },
        proxyRes: (proxyRes, req) => injectCors(proxyRes, req),
        error: onProxyError(serviceName),
    },
});
// ── Stripe Webhook: proxy raw ANTES del body parser y del auth ────────────
app.post('/api/orders/checkout/webhook', (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: services.orders || process.env.ORDERS_SERVICE_URL || 'http://orders-service:3004',
    changeOrigin: true,
    on: {
        error: onProxyError('orders-service (stripe-webhook)'),
    },
}));
app.use((0, http_proxy_middleware_1.createProxyMiddleware)({
    pathFilter: '/api/public/products',
    target: services.products,
    changeOrigin: true,
    pathRewrite: { '^/api/public/products': '/api/products' },
    on: {
        proxyRes: (proxyRes, req) => injectCors(proxyRes, req),
        error: onProxyError('products-service (public)')
    },
}));
app.use((0, http_proxy_middleware_1.createProxyMiddleware)({
    pathFilter: '/api/public/categories',
    target: services.products,
    changeOrigin: true,
    pathRewrite: { '^/api/public/categories': '/api/categories' },
    on: {
        proxyRes: (proxyRes, req) => injectCors(proxyRes, req),
        error: onProxyError('products-service (public)')
    },
}));
// ── Autenticación centralizada (JWT) ──────────────────────────────────────
app.use(auth_1.authMiddleware);
// ── Audit log de acciones admin ───────────────────────────────────────────
app.use(auditMiddleware_1.auditMiddleware);
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
app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(null, swaggerOptions));
// ── Swagger docs proxy ───────────────────────────────────────────────────
app.get('/api/docs.json', async (req, res) => {
    const svc = req.query.svc;
    const base = services[svc];
    if (!base) {
        res.status(400).json({ error: 'svc param must be products, inventory, orders, notifications or reports' });
        return;
    }
    try {
        const r = await fetch(`${base}/api/docs.json`);
        const json = await r.json();
        res.json(json);
    }
    catch (err) {
        logger_1.default.warn(`No se pudo obtener docs de ${svc}`, { error: err.message });
        res.status(503).json({ error: `${svc} service unavailable` });
    }
});
const v1Proxy = (serviceName, target, basePath) => (0, http_proxy_middleware_1.createProxyMiddleware)({
    target,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl.replace(`/api/v1${basePath}`, `/api${basePath}`),
    on: {
        proxyReq: (proxyReq, req) => {
            const cid = req.headers['x-correlation-id'];
            if (cid)
                proxyReq.setHeader('x-correlation-id', cid);
        },
        proxyRes: (proxyRes, req) => injectCors(proxyRes, req),
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
app.use('/api/v1/stores', v1Proxy('stores-service', services.stores, '/stores'));
// ── Legacy routes (/api/*) ────────────────────────────────────────────────
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
app.use('/api/settings', transparentProxy('users-service', services.users));
// AI routes
app.use('/api/ai', transparentProxy('ai-service', services.ai));
// Stores routes
app.use('/api/stores', transparentProxy('stores-service', services.stores));
// ── Imágenes subidas ──────────────────────────────────────────────────────
app.use('/uploads', transparentProxy('products-service', services.products));
// ── Health checks ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'API Gateway is running' });
});
// ── Dashboard stats (delegate a orders-service) ───────────────────────────
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const url = new URL(`${services.orders}/api/orders/stats`);
        if (req.query.period)
            url.searchParams.append('period', req.query.period);
        if (req.query.fecha)
            url.searchParams.append('fecha', req.query.fecha);
        const statsRes = await fetch(url.toString());
        if (!statsRes.ok) {
            logger_1.default.warn('Stats endpoint fallo, fallback a orders list', { status: statsRes.status });
            res.status(503).json({ error: 'No se pudieron obtener estadísticas' });
            return;
        }
        const data = await statsRes.json();
        res.json(data);
    }
    catch (err) {
        logger_1.default.error('Error obteniendo stats del dashboard', { error: err.message });
        res.status(503).json({ error: 'No se pudieron obtener estadísticas' });
    }
});
// ── Webhook interno para emisión de WebSockets ────────────────────────────
app.post('/api/internal/broadcast', express_1.default.json(), (req, res) => {
    const { event, payload } = req.body || {};
    if (event && app.locals.io) {
        app.locals.io.emit(event, payload);
        res.status(200).json({ ok: true, broadcasted: true });
    }
    else {
        res.status(400).json({ error: 'Falta event name o Socket.IO no está listo' });
    }
});
// ── Métricas (Prometheus) ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
    prom_client_1.default.collectDefaultMetrics({ prefix: 'gateway_' });
}
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', prom_client_1.default.register.contentType);
    res.end(await prom_client_1.default.register.metrics());
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
    stores: `${services.stores}/health`,
};
app.get('/health/all', async (_req, res) => {
    const results = {};
    await Promise.all(Object.entries(serviceHealthPaths).map(async ([name, healthUrl]) => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(healthUrl, { signal: controller.signal });
            clearTimeout(timeout);
            results[name] = { status: response.ok ? 'up' : 'down', statusCode: response.status };
        }
        catch (err) {
            results[name] = { status: 'down', error: err.message };
        }
    }));
    const allUp = Object.values(results).every((r) => r.status === 'up');
    res.status(allUp ? 200 : 503).json({
        gateway: 'up',
        services: results,
    });
});
// ── Global error handler ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    logger_1.default.error('API Gateway Error', { message: err.message });
    res.status(500).json({ error: 'Internal Server Error', code: 'GATEWAY_ERROR', message: 'Gateway panic' });
});
exports.default = app;
