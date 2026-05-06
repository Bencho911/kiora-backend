'use strict';

const logger = require('../config/logger');

/**
 * Cliente HTTP compartido para comunicación inter-servicio.
 *
 * Características:
 * - Timeout configurable via AbortController (default 5000ms).
 * - Backoff exponencial con jitter en reintentos.
 * - No reintenta en errores 4xx (excepto 429).
 * - Propaga x-correlation-id y Authorization automáticamente.
 *
 * @module utils/httpClient
 */

/* ── Timeouts por defecto (ms) ───────────────────────────────────────────── */

const DEFAULT_TIMEOUT_MS  = 5000;  // Escrituras inter-servicio
const NOTIFY_TIMEOUT_MS   = 3000;  // Notificaciones (broadcast, etc.)

/* ── Headers salientes ───────────────────────────────────────────────────── */

/**
 * Construye headers salientes para llamadas inter-servicio.
 * Propaga x-correlation-id y Authorization para trazabilidad y permisos.
 *
 * @param {object} headers — Headers originales del request entrante
 * @returns {object} Headers para la llamada saliente
 */
function outgoingHeaders(headers = {}) {
    const h = { 'Content-Type': 'application/json' };

    const cid = headers['x-correlation-id'];
    if (cid) h['x-correlation-id'] = cid;

    const auth = headers['authorization'] || headers['Authorization'];
    if (auth) h['Authorization'] = auth;

    return h;
}

/* ── Fetch con retry, timeout y backoff+jitter ───────────────────────────── */

/**
 * Realiza un fetch con reintentos, timeout por AbortController y backoff exponencial con jitter.
 *
 * Política de reintentos:
 * - Errores 4xx (400, 409, 422): NO reintenta — error de negocio.
 * - Error 429: reintenta respetando Retry-After si está presente.
 * - Errores 5xx o de red/timeout: reintenta con backoff exponencial + jitter.
 *
 * @param {string} url — URL destino
 * @param {object} options — Opciones estándar de fetch (method, headers, body, etc.)
 * @param {object} [retryOpts] — Opciones de retry
 * @param {number} [retryOpts.maxRetries=3] — Máximo de intentos
 * @param {number} [retryOpts.timeoutMs=5000] — Timeout de red por intento (ms)
 * @param {number} [retryOpts.baseDelayMs=500] — Delay base para backoff (ms)
 * @param {function} [retryOpts.onNonRetryable] — Callback: si retorna true para un status, no reintenta
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, {
    maxRetries = 3,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    baseDelayMs = 500,
    onNonRetryable,
} = {}) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(url, {
                ...options,
                signal: controller.signal,
            });

            clearTimeout(timer);

            // ── Éxito ──
            if (res.ok) return res;

            // ── Error de negocio (4xx) — no reintentar ──
            if (res.status >= 400 && res.status < 500 && res.status !== 429) {
                if (onNonRetryable && onNonRetryable(res.status)) return res;

                const errBody = await res.text();
                const err = new Error(`HTTP ${res.status}: ${errBody}`);
                err.status = res.status;
                throw err;
            }

            // ── 429 Too Many Requests — respetar Retry-After ──
            if (res.status === 429) {
                const retryAfter = res.headers.get('Retry-After');
                const waitMs = retryAfter ? Number(retryAfter) * 1000 : baseDelayMs * Math.pow(2, attempt - 1);
                logger.warn(`429 recibido, esperando ${waitMs}ms antes de reintentar`, { url, attempt });
                if (attempt < maxRetries) {
                    await new Promise((resolve) => setTimeout(resolve, waitMs));
                }
                lastError = new Error(`HTTP 429: Too Many Requests`);
                lastError.status = 429;
                continue;
            }

            // ── 5xx — reintentar con backoff ──
            const errBody = await res.text();
            logger.warn(`Intento ${attempt}/${maxRetries}: servidor respondió ${res.status}`, {
                url, statusCode: res.status, body: errBody,
            });
            lastError = new Error(`HTTP ${res.status}: ${errBody}`);
            lastError.status = res.status;

        } catch (err) {
            clearTimeout(timer);

            // ── Error de negocio propagado desde bloque 4xx ──
            if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
                throw err;
            }

            // ── Timeout (AbortError) ──
            if (err.name === 'AbortError') {
                logger.warn(`Intento ${attempt}/${maxRetries}: timeout (${timeoutMs}ms)`, { url });
                lastError = new Error(`Timeout tras ${timeoutMs}ms: ${url}`);
                lastError.code = 'ETIMEDOUT';
            } else {
                // ── Error de red genérico ──
                logger.warn(`Intento ${attempt}/${maxRetries}: error de red`, {
                    url, error: err.message,
                });
                lastError = err;
            }
        }

        // ── Backoff exponencial con jitter antes del siguiente intento ──
        if (attempt < maxRetries) {
            const delay = baseDelayMs * Math.pow(2, attempt - 1) * (0.5 + Math.random());
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

module.exports = { outgoingHeaders, fetchWithRetry, DEFAULT_TIMEOUT_MS, NOTIFY_TIMEOUT_MS };
