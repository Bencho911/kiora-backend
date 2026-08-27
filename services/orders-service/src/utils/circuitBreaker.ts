'use strict';

import CircuitBreaker from 'opossum';
import logger from '../config/logger';

/**
 * Métricas internas del circuit breaker para observabilidad.
 */
const metrics = {
    fires: 0,
    successes: 0,
    failures: 0,
    fallbacks: 0,
    opens: 0,
    closes: 0,
};

/**
 * Crea un circuit breaker con opossum.
 *
 * @param {Function} fn — Función asíncrona a proteger
 * @param {string} name — Nombre descriptivo para logs
 * @param {object} [opts] — Opciones de opossum
 * @returns {CircuitBreaker}
 */
export function createCircuitBreaker<TI extends any[], TR>(fn: (...args: TI) => Promise<TR>, name: string, opts: CircuitBreaker.Options = {}): CircuitBreaker<TI, TR> {
    const breaker = new CircuitBreaker(fn, {
        timeout: opts.timeout || 2000,            // Fail fast: 2s (no 10s)
        errorThresholdPercentage: opts.errorThresholdPercentage || 50,
        resetTimeout: opts.resetTimeout || 30000,
        volumeThreshold: opts.volumeThreshold || 5,
        ...opts,
    });

    breaker.on('fire', () => { metrics.fires++; });
    breaker.on('success', () => { metrics.successes++; });
    breaker.on('failure', () => { metrics.failures++; });

    breaker.on('open', () => {
        metrics.opens++;
        logger.warn(`⚡ Circuit breaker ABIERTO: ${name}`, {
            state: 'open', metrics: { ...metrics },
        });
    });

    breaker.on('halfOpen', () => {
        logger.info(`🔄 Circuit breaker HALF-OPEN: ${name}`, { state: 'halfOpen' });
    });

    breaker.on('close', () => {
        metrics.closes++;
        logger.info(`✅ Circuit breaker CERRADO: ${name}`, { state: 'closed' });
    });

    breaker.on('fallback', () => { metrics.fallbacks++; });

    breaker.fallback(() => {
        const err: any = new Error(`Servicio no disponible (circuit breaker abierto): ${name}`);
        err.code = 'CIRCUIT_OPEN';
        throw err;
    });

    return breaker;
}

/** Retorna snapshot de métricas para endpoints de observabilidad. */
export function getMetrics() {
    return { ...metrics };
}
