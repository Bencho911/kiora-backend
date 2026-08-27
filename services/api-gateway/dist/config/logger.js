"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const asyncContext_1 = require("../utils/asyncContext");
const SERVICE_NAME = process.env.SERVICE_NAME || 'api-gateway';
/**
 * logger.ts — API Gateway
 * Logger estructurado consistente con el resto de microservicios Kiora.
 * Inyecta automáticamente correlationId desde AsyncLocalStorage.
 */
// Custom format: inyecta correlationId desde AsyncLocalStorage
const correlationFormat = winston_1.default.format((info) => {
    const store = asyncContext_1.asyncContext.getStore();
    if (store) {
        info.correlationId = store.get('correlationId');
    }
    info.service = SERVICE_NAME;
    return info;
});
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(correlationFormat(), winston_1.default.format.timestamp({ format: 'HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, correlationId, service: _service, ...meta }) => {
        const cid = correlationId ? ` [${correlationId}]` : '';
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${timestamp} [${level}]${cid} ${message}${metaStr}`;
    })),
    transports: [new winston_1.default.transports.Console()],
});
exports.default = logger;
