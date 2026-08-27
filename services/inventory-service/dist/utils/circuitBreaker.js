'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const opossum_1 = __importDefault(require("opossum"));
const logger_1 = __importDefault(require("../config/logger"));
const metrics = {
    fires: 0,
    successes: 0,
    failures: 0,
    fallbacks: 0,
    opens: 0,
    closes: 0,
};
function createCircuitBreaker(fn, name, opts = {}) {
    const breaker = new opossum_1.default(fn, {
        timeout: opts.timeout || 2000, // Fail fast: 2s
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
        logger_1.default.warn(`⚡ Circuit breaker ABIERTO: ${name}`, {
            state: 'open', metrics: { ...metrics },
        });
    });
    breaker.on('halfOpen', () => {
        logger_1.default.info(`🔄 Circuit breaker HALF-OPEN: ${name}`, { state: 'halfOpen' });
    });
    breaker.on('close', () => {
        metrics.closes++;
        logger_1.default.info(`✅ Circuit breaker CERRADO: ${name}`, { state: 'closed' });
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
exports.default = { createCircuitBreaker, getMetrics };
