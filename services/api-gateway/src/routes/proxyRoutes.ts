import { Router, Request } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { services } from '../config/services';
import { logger } from '@kiora/shared';
import { injectCors } from '../middleware/corsMiddleware';

const publicProxyRouter = Router();
const protectedProxyRouter = Router();

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

// ── Stripe Webhook: proxy raw ANTES del body parser y del auth ────────────
publicProxyRouter.post(
    '/api/orders/checkout/webhook',
    createProxyMiddleware({
        target: services.orders || process.env.ORDERS_SERVICE_URL || 'http://orders-service:3004',
        changeOrigin: true,
        on: {
            error: onProxyError('orders-service (stripe-webhook)'),
        } as any,
    })
);

publicProxyRouter.use(createProxyMiddleware({
    pathFilter: '/api/public/products',
    target: services.products,
    changeOrigin: true,
    pathRewrite: { '^/api/public/products': '/api/products' },
    on: {
        proxyRes: (proxyRes: any, req: any) => injectCors(proxyRes, req),
        error: onProxyError('products-service (public)')
    } as any,
}));

publicProxyRouter.use(createProxyMiddleware({
    pathFilter: '/api/public/categories',
    target: services.products,
    changeOrigin: true,
    pathRewrite: { '^/api/public/categories': '/api/categories' },
    on: {
        proxyRes: (proxyRes: any, req: any) => injectCors(proxyRes, req),
        error: onProxyError('products-service (public)')
    } as any,
}));

// ── Auth public routes (/api/auth/*) — sin /v1, sin JWT ───────────────────
publicProxyRouter.use('/api/auth', createProxyMiddleware({
    target: services.users,
    changeOrigin: true,
    pathRewrite: (path) => `/api/auth${path}`,
    on: {
        proxyReq: (proxyReq: any, req: any) => {
            const cid = req.headers['x-correlation-id'];
            if (cid) proxyReq.setHeader('x-correlation-id', cid);
        },
        proxyRes: (proxyRes: any, req: any) => injectCors(proxyRes, req),
        error: onProxyError('users-service (auth-public)'),
    } as any,
}));

// ── Versioned routes (/api/v1/*) ──────────────────────────────────────────
protectedProxyRouter.use('/api/v1/users', v1Proxy('users-service', services.users, '/users'));
protectedProxyRouter.use('/api/v1/auth', v1Proxy('users-service', services.users, '/auth'));
protectedProxyRouter.use('/api/v1/products', v1Proxy('products-service', services.products, '/products'));
protectedProxyRouter.use('/api/v1/categories', v1Proxy('products-service', services.products, '/categories'));
protectedProxyRouter.use('/api/v1/inventory', v1Proxy('inventory-service', services.inventory, '/inventory'));
protectedProxyRouter.use('/api/v1/orders', v1Proxy('orders-service', services.orders, '/orders'));
protectedProxyRouter.use('/api/v1/invoices', v1Proxy('orders-service', services.orders, '/invoices'));
protectedProxyRouter.use('/api/v1/notifications', v1Proxy('notifications-service', services.notifications, '/notifications'));
protectedProxyRouter.use('/api/v1/reports', v1Proxy('reports-service', services.reports, '/reports'));
protectedProxyRouter.use('/api/v1/activity-logs', v1Proxy('activity-service', services.activity, '/activity-logs'));
protectedProxyRouter.use('/api/v1/incidents', v1Proxy('users-service', services.users, '/incidents'));
protectedProxyRouter.use('/api/v1/ai', v1Proxy('ai-service', services.ai, '/ai'));
protectedProxyRouter.use('/api/v1/stores', v1Proxy('stores-service', services.stores, '/stores'));

protectedProxyRouter.use('/api/v1/settings', v1Proxy('users-service', services.users, '/settings'));

// ── Imágenes subidas ──────────────────────────────────────────────────────
protectedProxyRouter.use('/uploads', transparentProxy('products-service', services.products));

export { publicProxyRouter, protectedProxyRouter };
