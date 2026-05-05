'use strict';

const { createLogger, format, transports } = require('winston');

const isDev = process.env.NODE_ENV !== 'production';

const logger = createLogger({
    level: isDev ? 'debug' : 'info',
    format: isDev
        ? format.combine(
            format.colorize(),
            format.timestamp({ format: 'HH:mm:ss' }),
            format.printf(({ timestamp, level, message, ...meta }) => {
                const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} [${level}] ${message}${extra}`;
            })
        )
        : format.combine(format.timestamp(), format.json()),
    transports: [new transports.Console()],
});

module.exports = logger;
