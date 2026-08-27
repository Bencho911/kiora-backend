"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_js_1 = __importDefault(require("./config/swagger.js"));
const reportRoutes_js_1 = __importDefault(require("./routes/reportRoutes.js"));
const electronicInvoiceRoutes_js_1 = __importDefault(require("./routes/electronicInvoiceRoutes.js"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express_1.default.json());
// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
const correlationMiddleware_js_1 = __importDefault(require("./middlewares/correlationMiddleware.js"));
app.use(correlationMiddleware_js_1.default);
// Health Check
app.get('/api/reports/health', (req, res) => res.status(200).json({ status: 'OK' }));
// Swagger
app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_js_1.default, {
    customSiteTitle: 'Kiora — Reports Service',
}));
app.get('/api/docs.json', (_req, res) => res.json(swagger_js_1.default));
app.use('/api/reports/electronic-invoice', electronicInvoiceRoutes_js_1.default);
app.use('/api/reports', reportRoutes_js_1.default);
exports.default = app;
