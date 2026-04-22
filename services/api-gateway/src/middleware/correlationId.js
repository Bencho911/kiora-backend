/**
 * correlationId.js
 * Genera x-correlation-id por request si el cliente no envía x-correlation-id ni x-request-id.
 * El gateway reinyecta el id en el proxy hacia microservicios y lo devuelve en la respuesta.
 */
const crypto = require('crypto');

const correlationId = (req, res, next) => {
    const id =
        req.headers['x-correlation-id'] ||
        req.headers['x-request-id'] ||
        crypto.randomUUID();
    req.headers['x-correlation-id'] = id;
    res.setHeader('x-correlation-id', id);
    next();
};

module.exports = correlationId;
