"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = require("winston");
const asyncContext_1 = __importDefault(require("../utils/asyncContext"));
const isDev = process.env.NODE_ENV !== 'production';
const SERVICE_NAME = process.env.SERVICE_NAME || 'products-service';
const correlationFormat = (0, winston_1.format)((info) => {
    const store = asyncContext_1.default.getStore();
    if (store) {
        info.correlationId = store.get('correlationId');
    }
    info.service = SERVICE_NAME;
    return info;
});
const logger = (0, winston_1.createLogger)({
    level: isDev ? 'debug' : 'info',
    format: isDev
        ? winston_1.format.combine(correlationFormat(), winston_1.format.colorize(), winston_1.format.timestamp({ format: 'HH:mm:ss' }), winston_1.format.printf(({ timestamp, level, message, correlationId, service: _service, ...meta }) => {
            const cid = correlationId ? ` [${correlationId}]` : '';
            const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}]${cid} ${message}${extra}`;
        }))
        : winston_1.format.combine(correlationFormat(), winston_1.format.timestamp(), winston_1.format.json()),
    transports: [new winston_1.transports.Console()],
});
exports.default = logger;
