'use strict';

/**
 * correlationMiddleware.js
 *
 * Extrae el x-correlation-id del request entrante (propagado por el API Gateway)
 * y lo almacena en el AsyncLocalStorage para que Winston lo inyecte automáticamente
 * en cada línea de log durante todo el ciclo de vida del request.
 *
 * Si no viene correlation-id (ej: llamada directa sin gateway), genera uno con crypto.
 */
const crypto = require('crypto');
const asyncContext = require('../utils/asyncContext');

const correlationMiddleware = (req, _res, next) => {
    const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
    const store = new Map([['correlationId', correlationId]]);
    asyncContext.run(store, () => next());
};

module.exports = correlationMiddleware;
