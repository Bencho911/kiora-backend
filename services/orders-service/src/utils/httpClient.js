'use strict';

const logger = require('../config/logger');

/**
 * Construye headers salientes para llamadas inter-servicio.
 * Propaga el correlation-id para trazabilidad distribuida.
 */
function outgoingHeaders(headers) {
    const h = { 'Content-Type': 'application/json' };
    const cid = headers['x-correlation-id'];
    if (cid) h['x-correlation-id'] = cid;

    // Propagar Authorization para permisos inter-servicio
    const auth = headers['authorization'] || headers['Authorization'];
    if (auth) h['Authorization'] = auth;
    
    return h;
}

/**
 * Realiza un fetch con retry y exponential backoff.
 */
async function fetchWithRetry(url, options, { maxRetries = 3, onNonRetryable } = {}) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            if (onNonRetryable && onNonRetryable(res.status)) return res;

            const errBody = await res.text();
            logger.warn(`Intento ${attempt}/${maxRetries}: fallo en fetch`, {
                url, statusCode: res.status, body: errBody,
            });
            lastError = new Error(`HTTP ${res.status}: ${errBody}`);
            lastError.status = res.status;
        } catch (err) {
            logger.warn(`Intento ${attempt}/${maxRetries}: error de red`, {
                url, error: err.message,
            });
            lastError = err;
        }

        if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        }
    }

    throw lastError;
}

module.exports = { outgoingHeaders, fetchWithRetry };
