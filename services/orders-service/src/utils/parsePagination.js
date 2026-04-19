'use strict';

/**
 * Parsea parámetros de paginación del query string.
 * Elimina el patrón copy-paste Math.max(1, parseInt(...)) de los controllers.
 *
 * @param {object} query - req.query
 * @param {{ defaultLimit?: number, maxLimit?: number }} opts
 * @returns {{ page: number, limit: number, offset: number }}
 */
const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
    const page   = Math.max(1, parseInt(query.page  || 1, 10));
    const limit  = Math.min(maxLimit, Math.max(1, parseInt(query.limit || defaultLimit, 10)));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};

module.exports = parsePagination;
