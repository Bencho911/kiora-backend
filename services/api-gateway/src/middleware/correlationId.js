/**
 * correlationId.js
 * Genera x-correlation-id por request si el cliente no envía x-correlation-id ni x-request-id.
 * El gateway reinyecta el id en el proxy hacia microservicios y lo devuelve en la respuesta.
 *
 * Además, almacena el correlationId en AsyncLocalStorage para que el logger
 * lo inyecte automáticamente en cada línea de log del gateway.
 */
const crypto = require('crypto');
const asyncContext = require('../utils/asyncContext');

const correlationId = (req, res, next) => {
    const id =
        req.headers['x-correlation-id'] ||
        req.headers['x-request-id'] ||
        crypto.randomUUID();
    req.headers['x-correlation-id'] = id;
    res.setHeader('x-correlation-id', id);

    // Envolver el request en AsyncLocalStorage para que Winston lo lea
    const store = new Map([['correlationId', id]]);
    asyncContext.run(store, () => next());
};

module.exports = correlationId;
