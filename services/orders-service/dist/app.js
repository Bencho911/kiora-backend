"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = __importDefault(require("./config/swagger"));
const env_1 = __importDefault(require("./config/env"));
const logger_1 = __importDefault(require("./config/logger"));
const correlationMiddleware_1 = __importDefault(require("./middlewares/correlationMiddleware"));
const prom_client_1 = __importDefault(require("prom-client"));
const db_1 = __importDefault(require("./config/db"));
const invoiceRoutes_1 = __importDefault(require("./routes/invoiceRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const exportRoutes_1 = __importDefault(require("./routes/exportRoutes"));
const settlementRoutes_1 = __importDefault(require("./routes/settlementRoutes"));
const sessionRoutes_1 = __importDefault(require("./routes/sessionRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: env_1.default.corsOrigin, credentials: true }));
// Body parser global para el resto de rutas
app.use(express_1.default.json());
// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
app.use(correlationMiddleware_1.default);
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'orders-service' }));
// ── Métricas (Prometheus) ─────────────────────────────────────────────────
prom_client_1.default.collectDefaultMetrics({ prefix: 'orders_' });
// Histograma de latencia por ruta para p95/p99
const httpDuration = new prom_client_1.default.Histogram({
    name: 'orders_http_request_duration_seconds',
    help: 'Duración de requests HTTP en orders-service',
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
    res.set('Content-Type', prom_client_1.default.register.contentType);
    res.end(await prom_client_1.default.register.metrics());
});
// ── Readiness (verifica conectividad con PostgreSQL) ──────────────────────
app.get('/health/ready', async (_req, res) => {
    try {
        await db_1.default.query('SELECT 1');
        res.status(200).json({ status: 'ready', checks: { postgres: true } });
    }
    catch (err) {
        logger_1.default.warn('Readiness check falló', { error: err.message });
        res.status(503).json({ status: 'not_ready', error: 'PostgreSQL no responde.' });
    }
});
// ── Documentación Swagger ─────────────────────────────────────────────────
app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.default, {
    customSiteTitle: 'Kiora — Orders Service',
}));
app.get('/api/docs.json', (_req, res) => res.json(swagger_1.default));
// ── Rutas ─────────────────────────────────────────────────────────────────
// IMPORTANTE: invoices y settlement deben ir ANTES de /:id para evitar conflicto de rutas
app.use('/api/invoices', invoiceRoutes_1.default);
app.use('/api/orders/checkout', paymentRoutes_1.default);
app.use('/api/orders/export', exportRoutes_1.default);
app.use('/api/orders/settlement', settlementRoutes_1.default);
app.use('/api/orders/sessions', sessionRoutes_1.default);
app.use('/api/orders', orderRoutes_1.default);
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    logger_1.default.error('Error no controlado', { message: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        error: err.status ? err.message : 'Error interno del servidor.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    });
});
exports.default = app;
