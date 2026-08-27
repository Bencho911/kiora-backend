"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = __importDefault(require("./config/logger"));
const correlationMiddleware_1 = require("./middlewares/correlationMiddleware");
const prom_client_1 = __importDefault(require("prom-client"));
const db_1 = __importDefault(require("./config/db"));
const regionRoutes_1 = __importDefault(require("./routes/regionRoutes"));
const ciudadRoutes_1 = __importDefault(require("./routes/ciudadRoutes"));
const storeRoutes_1 = __importDefault(require("./routes/storeRoutes"));
const app = (0, express_1.default)();
// ── Seguridad y parseo ───────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => callback(null, origin || '*'),
    credentials: true,
}));
app.use(express_1.default.json());
// ── Correlation ID ────────────────────────────────────────────────────────
app.use(correlationMiddleware_1.correlationMiddleware);
// ── Health-check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'stores-service' }));
// ── Métricas (Prometheus) ─────────────────────────────────────────────────
prom_client_1.default.collectDefaultMetrics({ prefix: 'stores_' });
const httpDuration = new prom_client_1.default.Histogram({
    name: 'stores_http_request_duration_seconds',
    help: 'Duración de requests HTTP en stores-service',
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
// ── Rutas ─────────────────────────────────────────────────────────────────
app.use('/api/stores/regiones', regionRoutes_1.default);
app.use('/api/stores/ciudades', ciudadRoutes_1.default);
app.use('/api/stores', storeRoutes_1.default);
// ── Manejo global de errores ──────────────────────────────────────────────
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
