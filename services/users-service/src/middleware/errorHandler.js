const logger = require('../config/logger');

const errorHandler = (err, req, res, _next) => {
    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor.';

    logger.error(message, {
        status,
        method: req.method,
        url: req.originalUrl,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });

    res.status(status).json({ error: message });
};

module.exports = errorHandler;
