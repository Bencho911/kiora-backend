import { createLogger, format, transports } from 'winston';
import { asyncContext } from '../utils/asyncContext';

const SERVICE_NAME = process.env.SERVICE_NAME || 'users-service';

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
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: format.combine(
        correlationFormat(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.json()
    ),
    transports: [
        // Consola: siempre activa, con colores en desarrollo
        new transports.Console({
            format: process.env.NODE_ENV === 'production'
                ? format.json()
                : format.combine(
                    format.colorize(),
                    format.printf(({ timestamp, level, message, correlationId, service: _service, ...meta }) => {
                        const cid = correlationId ? ` [${correlationId}]` : '';
                        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                        return `${timestamp} [${level}]:${cid} ${message}${extra}`;
                    })
                )
        }),
        // Archivo de errores (solo en producción)
        ...(process.env.NODE_ENV === 'production'
            ? [new transports.File({ filename: 'logs/error.log', level: 'error' }),
            new transports.File({ filename: 'logs/combined.log' })]
            : [])
    ],
});

export default logger;
