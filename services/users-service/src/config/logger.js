const winston = require('winston');

/**
 * logger
 * Responsabilidad única: configuración centralizada de logging.
 * Reemplaza todos los console.log/error del proyecto.
 *
 * Niveles: error > warn > info > debug
 */
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        // Consola: siempre activa, con colores en desarrollo
        new winston.transports.Console({
            format: process.env.NODE_ENV === 'production'
                ? winston.format.json()
                : winston.format.combine(
                    winston.format.colorize(),
                    winston.format.printf(({ timestamp, level, message, ...meta }) => {
                        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                        return `${timestamp} [${level}]: ${message}${extra}`;
                    })
                )
        }),
        // Archivo de errores (solo en producción)
        ...(process.env.NODE_ENV === 'production'
            ? [new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
            new winston.transports.File({ filename: 'logs/combined.log' })]
            : [])
    ],
});

module.exports = logger;
