'use strict';

const winston = require('winston');

/**
 * logger.js — API Gateway
 * Logger estructurado consistente con el resto de microservicios Kiora.
 */
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `${timestamp} [${level}] ${message}${metaStr}`;
        })
    ),
    transports: [new winston.transports.Console()],
});

module.exports = logger;
