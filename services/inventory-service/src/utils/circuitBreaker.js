'use strict';

const CircuitBreaker = require('opossum');
const logger = require('../config/logger');

const metrics = {
    fires: 0,
    successes: 0,
    failures: 0,
    fallbacks: 0,
    opens: 0,
    closes: 0,
};

function createCircuitBreaker(fn, name, opts = {}) {
    const breaker = new CircuitBreaker(fn, {
        timeout: opts.timeout || 2000,            // Fail fast: 2s
        errorThresholdPercentage: opts.errorThreshold || 50,
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
        const err = new Error(`Servicio no disponible (circuit breaker abierto): ${name}`);
        err.code = 'CIRCUIT_OPEN';
        throw err;
    });

    return breaker;
}

function getMetrics() {
    return { ...metrics };
}

module.exports = { createCircuitBreaker, getMetrics };
