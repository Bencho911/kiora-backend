import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import logger from './config/logger';
import { correlationId } from './middleware/correlationId';
import { authMiddleware } from './middleware/auth';
import { auditMiddleware } from './middleware/auditMiddleware';
import promClient from 'prom-client';

const app = express();

// ── Configuración de Seguridad y Middlewares Globales ──────────────────────
app.use(helmet({
    contentSecurityPolicy: false,
}));

const ALLOWED_ORIGINS = new Set(
    (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim())
);

// Middleware CORS manual: se ejecuta antes y después del proxy
app.use((req: Request, res: Response, next: NextFunction) => {
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
function injectCors(proxyRes: any, req: any) {
    const reqOrigin = req.headers.origin;
    if (reqOrigin) {
        proxyRes.headers['access-control-allow-origin'] = reqOrigin;
        proxyRes.headers['access-control-allow-credentials'] = 'true';
        proxyRes.headers['vary'] = 'Origin';
    }
}

app.use(morgan('dev'));
app.use(cookieParser());

app.use(correlationId);

// ── Rate Limiting Distribuido (Redis con fail-open) ───────────────────────
let redisReady = false;
let redisClient: Redis | undefined;

if (process.env.NODE_ENV !== 'test') {
    redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: null,
        connectTimeout: 3000,
        retryStrategy(times) {
            if (times > 5) return null;
            return Math.min(times * 500, 3000);
        },
    });

    redisClient.on('connect', () => { redisReady = true; logger.info('Rate limiter: Redis conectado'); });
    redisClient.on('close', () => { redisReady = false; });
    redisClient.on('error', (err: any) => { redisReady = false; logger.warn('Rate limiter: Redis error', { error: err.message }); });

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
        sendCommand: (...args: string[]) => redisClient!.call(args[0], ...args.slice(1)) as any,
    }),
    message: { error: 'Too Many Requests', code: 'RATE_LIMIT', message: 'Límite de peticiones excedido (2000/15min), intenta más tarde.' },
}) : null;

// Fail-open: si Redis no está listo, skip rate limiting
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (!redisReady || !redisLimiter) return next();
    return redisLimiter(req, res, next);
});

// ── Deprecation middleware para rutas sin versionar ───────────────────────
const deprecationMiddleware = (req: Request, res: Response, next: NextFunction) => {
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
const services: Record<string, string> = {
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
const onProxyError = (serviceName: string) => (err: Error, req: any, res: any) => {
    logger.error(`[Proxy Error] ${serviceName}: ${err.message}`);
    res.status(503).json({
        error: 'Service Unavailable',
        code: 'SERVICE_UNAVAILABLE',
        service: serviceName,
        message: 'El microservicio no está disponible en este momento.',
    });
};

const transparentProxy = (serviceName: string, target: string) =>
    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: (path, req) => (req as Request).originalUrl,
        on: {
            proxyReq: (proxyReq: any, req: any) => {
                const cid = req.headers['x-correlation-id'];
                if (cid) proxyReq.setHeader('x-correlation-id', cid);
            },
            proxyRes: (proxyRes: any, req: any) => injectCors(proxyRes, req),
            error: onProxyError(serviceName),
        } as any,
    });

// ── Stripe Webhook: proxy raw ANTES del body parser y del auth ────────────
app.post(
    '/api/orders/checkout/webhook',
    createProxyMiddleware({
        target: services.orders || process.env.ORDERS_SERVICE_URL || 'http://orders-service:3004',
        changeOrigin: true,
        on: {
            error: onProxyError('orders-service (stripe-webhook)'),
        } as any,
    })
);

app.use(createProxyMiddleware({
    pathFilter: '/api/public/products',
    target: services.products,
    changeOrigin: true,
    pathRewrite: { '^/api/public/products': '/api/products' },
    on: {
        proxyRes: (proxyRes: any, req: any) => injectCors(proxyRes, req),
        error: onProxyError('products-service (public)')
    } as any,
}));
app.use(createProxyMiddleware({
    pathFilter: '/api/public/categories',
    target: services.products,
    changeOrigin: true,
    pathRewrite: { '^/api/public/categories': '/api/categories' },
    on: {
        proxyRes: (proxyRes: any, req: any) => injectCors(proxyRes, req),
        error: onProxyError('products-service (public)')
    } as any,
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
app.get('/api/docs.json', async (req: Request, res: Response) => {
    const svc = req.query.svc as string;
    const base = services[svc];
    if (!base) {
        res.status(400).json({ error: 'svc param must be products, inventory, orders, notifications or reports' });
        return;
    }
    try {
        const r = await fetch(`${base}/api/docs.json`);
        const json = await r.json();
        res.json(json);
    } catch (err: any) {
        logger.warn(`No se pudo obtener docs de ${svc}`, { error: err.message });
        res.status(503).json({ error: `${svc} service unavailable` });
    }
});

const v1Proxy = (serviceName: string, target: string, basePath: string) =>
    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: (path, req) =>
            (req as Request).originalUrl.replace(`/api/v1${basePath}`, `/api${basePath}`),
        on: {
            proxyReq: (proxyReq: any, req: any) => {
                const cid = req.headers['x-correlation-id'];
                if (cid) proxyReq.setHeader('x-correlation-id', cid);
            },
            proxyRes: (proxyRes: any, req: any) => injectCors(proxyRes, req),
            error: onProxyError(serviceName),
        } as any,
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
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'API Gateway is running' });
});

// ── Dashboard stats (delegate a orders-service) ───────────────────────────
app.get('/api/dashboard/stats', async (req: Request, res: Response) => {
    try {
        const url = new URL(`${services.orders}/api/orders/stats`);
        if (req.query.period) url.searchParams.append('period', req.query.period as string);
        if (req.query.fecha) url.searchParams.append('fecha', req.query.fecha as string);

        const statsRes = await fetch(url.toString());
        if (!statsRes.ok) {
            logger.warn('Stats endpoint fallo, fallback a orders list', { status: statsRes.status });
            res.status(503).json({ error: 'No se pudieron obtener estadísticas' });
            return;
        }
        const data = await statsRes.json();
        res.json(data);
    } catch (err: any) {
        logger.error('Error obteniendo stats del dashboard', { error: err.message });
        res.status(503).json({ error: 'No se pudieron obtener estadísticas' });
    }
});

// ── Webhook interno para emisión de WebSockets ────────────────────────────
app.post('/api/internal/broadcast', express.json(), (req: Request, res: Response) => {
    const { event, payload } = req.body || {};
    if (event && app.locals.io) {
        app.locals.io.emit(event, payload);
        res.status(200).json({ ok: true, broadcasted: true });
    } else {
        res.status(400).json({ error: 'Falta event name o Socket.IO no está listo' });
    }
});

// ── Métricas (Prometheus) ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
    promClient.collectDefaultMetrics({ prefix: 'gateway_' });
}
app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

const serviceHealthPaths: Record<string, string> = {
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

app.get('/health/all', async (_req: Request, res: Response) => {
    const results: Record<string, any> = {};

    await Promise.all(
        Object.entries(serviceHealthPaths).map(async ([name, healthUrl]) => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const response = await fetch(healthUrl, { signal: controller.signal });
                clearTimeout(timeout);
                results[name] = { status: response.ok ? 'up' : 'down', statusCode: response.status };
            } catch (err: any) {
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
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('API Gateway Error', { message: err.message });
    res.status(500).json({ error: 'Internal Server Error', code: 'GATEWAY_ERROR', message: 'Gateway panic' });
});

export default app;
