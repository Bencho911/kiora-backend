"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditMiddleware = void 0;
const logger_1 = __importDefault(require("../config/logger"));
/**
 * auditMiddleware
 * Registra acciones administrativas (PUT, DELETE, POST en rutas sensibles)
 * en los logs estructurados. Se puede extender para escribir en una tabla audit_logs.
 */
const AUDITED_METHODS = ['PUT', 'DELETE', 'PATCH'];
const AUDITED_PATHS = [
    '/api/products',
    '/api/categories',
    '/api/inventory',
    '/api/orders',
    '/api/users',
    '/api/v1/products',
    '/api/v1/categories',
    '/api/v1/inventory',
    '/api/v1/orders',
    '/api/v1/users',
];
const shouldAudit = (method, path) => {
    if (!AUDITED_METHODS.includes(method))
        return false;
    return AUDITED_PATHS.some((prefix) => path.startsWith(prefix));
};
const auditMiddleware = (req, res, next) => {
    if (!shouldAudit(req.method, req.path))
        return next();
    const startTime = Date.now();
    // Capturar info antes de que el proxy reescriba
    const auditEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        userId: req.headers['x-user-id'] || 'anonymous',
        userRole: req.headers['x-user-role'] || 'unknown',
        ip: req.ip || req.socket?.remoteAddress,
        correlationId: req.headers['x-correlation-id'] || null,
    };
    // Interceptar el response para capturar el status code
    const originalEnd = res.end;
    res.end = function (...args) {
        auditEntry.statusCode = res.statusCode;
        auditEntry.duration = Date.now() - startTime;
        if (res.statusCode < 400) {
            logger_1.default.info('AUDIT', auditEntry);
        }
        else {
            logger_1.default.warn('AUDIT (failed)', auditEntry);
        }
        return originalEnd.apply(this, args);
    };
    next();
};
exports.auditMiddleware = auditMiddleware;
