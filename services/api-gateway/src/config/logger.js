'use strict';

const winston = require('winston');
const asyncContext = require('../utils/asyncContext');

const SERVICE_NAME = process.env.SERVICE_NAME || 'api-gateway';

/**
 * logger.js — API Gateway
 * Logger estructurado consistente con el resto de microservicios Kiora.
 * Inyecta automáticamente correlationId desde AsyncLocalStorage.
 */

// Custom format: inyecta correlationId desde AsyncLocalStorage
const correlationFormat = winston.format((info) => {
    const store = asyncContext.getStore();
    if (store) {
        info.correlationId = store.get('correlationId');
    }
    info.service = SERVICE_NAME;
    return info;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        correlationFormat(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, correlationId, service: _service, ...meta }) => {
            const cid = correlationId ? ` [${correlationId}]` : '';
            const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `${timestamp} [${level}]${cid} ${message}${metaStr}`;
        })
    ),
    transports: [new winston.transports.Console()],
});

module.exports = logger;
