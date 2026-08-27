'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * correlationMiddleware.js
 *
 * Extrae el x-correlation-id del request entrante (propagado por el API Gateway)
 * y lo almacena en el AsyncLocalStorage para que Winston lo inyecte automáticamente
 * en cada línea de log durante todo el ciclo de vida del request.
 *
 * Si no viene correlation-id (ej: llamada directa sin gateway), genera uno con crypto.
 */
const crypto_1 = __importDefault(require("crypto"));
const asyncContext_1 = __importDefault(require("../utils/asyncContext"));
const correlationMiddleware = (req, _res, next) => {
    const correlationId = req.headers['x-correlation-id'] || crypto_1.default.randomUUID();
    const store = new Map([['correlationId', correlationId]]);
    asyncContext_1.default.run(store, () => next());
};
exports.default = correlationMiddleware;
