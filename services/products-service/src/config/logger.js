'use strict';

const { createLogger, format, transports } = require('winston');
const asyncContext = require('../utils/asyncContext');

const isDev = process.env.NODE_ENV !== 'production';
const SERVICE_NAME = process.env.SERVICE_NAME || 'products-service';

/**
 * Logger estructurado con inyección automática de correlationId.
 *
 * - En desarrollo: formato legible con colores y correlationId visible.
 * - En producción: JSON puro con service, correlationId, timestamp — ideal para
 *   ELK, Datadog, CloudWatch o cualquier agregador de logs.
 *
 * El correlationId se lee automáticamente del AsyncLocalStorage (inyectado
 * por correlationMiddleware), sin necesidad de pasarlo manualmente.
 */

// Custom format: inyecta correlationId desde AsyncLocalStorage
const correlationFormat = format((info) => {
    const store = asyncContext.getStore();
    if (store) {
        info.correlationId = store.get('correlationId');
    }
    info.service = SERVICE_NAME;
    return info;
});

const logger = createLogger({
    level: isDev ? 'debug' : 'info',
    format: isDev
        ? format.combine(
            correlationFormat(),
            format.colorize(),
            format.timestamp({ format: 'HH:mm:ss' }),
            format.printf(({ timestamp, level, message, correlationId, service: _service, ...meta }) => {
                const cid = correlationId ? ` [${correlationId}]` : '';
                const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} [${level}]${cid} ${message}${extra}`;
            })
        )
        : format.combine(
            correlationFormat(),
            format.timestamp(),
            format.json()
        ),
    transports: [new transports.Console()],
});

module.exports = logger;
