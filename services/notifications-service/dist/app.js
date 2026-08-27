'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const logger_js_1 = __importDefault(require("./config/logger.js"));
const env_js_1 = __importDefault(require("./config/env.js"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
const correlationMiddleware_js_1 = __importDefault(require("./middlewares/correlationMiddleware.js"));
app.use(correlationMiddleware_js_1.default);
// ── Rutas ─────────────────────────────────────────────────────────────────
const alertRoutes_js_1 = __importDefault(require("./routes/alertRoutes.js"));
app.use('/api/notifications/alerts', alertRoutes_js_1.default);
// ── Swagger ───────────────────────────────────────────────────────────────
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_js_1 = __importDefault(require("./config/swagger.js"));
app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_js_1.default));
app.get('/api/docs.json', (_req, res) => res.json(swagger_js_1.default));
// ── Health-check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
    status: 'ok',
    service: 'notifications-service',
    redis: { host: env_js_1.default.redis.host, port: env_js_1.default.redis.port },
}));
// ── Readiness (verifica conectividad con Redis) ───────────────────────────
const ioredis_1 = __importDefault(require("ioredis"));
const readinessClient = new ioredis_1.default({
    host: env_js_1.default.redis.host,
    port: env_js_1.default.redis.port,
    password: env_js_1.default.redis.password,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
});
app.get('/health/ready', async (_req, res) => {
    try {
        await readinessClient.ping();
        res.status(200).json({ status: 'ready', checks: { redis: true } });
    }
    catch (err) {
        logger_js_1.default.warn('Readiness check falló', { error: err.message });
        res.status(503).json({ status: 'not_ready', error: 'Redis no responde.' });
    }
});
// ── Manejo global de errores ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    logger_js_1.default.error('Error no controlado', { message: err.message });
    res.status(err.status || 500).json({
        error: err.status ? err.message : 'Error interno del servidor.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    });
});
exports.default = app;
