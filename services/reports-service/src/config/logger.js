'use strict';

const { createLogger, format, transports } = require('winston');
const asyncContext = require('../utils/asyncContext');

const SERVICE_NAME = process.env.SERVICE_NAME || 'reports-service';

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
    level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    format: format.combine(
        correlationFormat(),
        format.timestamp(),
        format.json()
    ),
    transports: [new transports.Console()],
});

module.exports = logger;
