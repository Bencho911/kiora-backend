'use strict';

const Redis = require('ioredis');
const logger = require('../config/logger');
const env = require('../config/env');

/**
 * cacheService — Versioned Namespacing
 *
 * En lugar de SCAN para invalidar claves, usamos un "version key":
 *   products:_version → número incrementado en cada write
 *   products:v{N}:list:1:20 → datos cacheados
 *
 * Invalidar = incrementar version. Las claves antiguas expiran por TTL.
 * Zero SCAN, zero CPU overhead, O(1) invalidation.
 */

let redis = null;

/** Métricas internas */
const metrics = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    errors: 0,
};

function getRedis() {
    if (redis) return redis;

    redis = new Redis({
        host: env.redis.host,
        port: env.redis.port,
        password: env.redis.password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
        },
    });

    redis.on('connect', () => logger.info('Redis cache conectado'));
    redis.on('error', (err) => logger.warn('Redis cache error', { error: err.message }));

    redis.connect().catch(() => {
        logger.warn('No se pudo conectar a Redis cache — el servicio funcionará sin cache');
    });

    return redis;
}

/**
 * Obtiene la versión actual del namespace.
 * Si no existe, la crea con valor 1.
 */
async function getVersion(namespace) {
    const client = getRedis();
    try {
        let v = await client.get(`${namespace}:_version`);
        if (!v) {
            await client.set(`${namespace}:_version`, '1');
            v = '1';
        }
        return v;
    } catch (err) {
        return '0'; // Fallback: sin versión, todo será MISS
    }
}

/**
 * Cache-aside con versioned namespacing.
 *
 * @param {string} namespace — Namespace base (ej: 'products')
 * @param {string} subkey — Sub-clave (ej: 'list:1:20')
 * @param {Function} fetchFn — Función que obtiene datos si cache MISS
 * @param {number} [ttl] — TTL en segundos
 */
async function getOrSet(namespace, subkey, fetchFn, ttl) {
    const client = getRedis();
    const effectiveTtl = ttl || env.redis.cacheTtl;

    try {
        const version = await getVersion(namespace);
        const fullKey = `${namespace}:v${version}:${subkey}`;

        const cached = await client.get(fullKey);
        if (cached) {
            metrics.hits++;
            logger.debug('Cache HIT', { key: fullKey });
            return JSON.parse(cached);
        }
        metrics.misses++;
    } catch (err) {
        metrics.errors++;
        logger.warn('Cache GET fallido, consultando BD', { error: err.message });
    }

    // Cache MISS → fetch from source
    const data = await fetchFn();

    try {
        const version = await getVersion(namespace);
        const fullKey = `${namespace}:v${version}:${subkey}`;
        await client.setex(fullKey, effectiveTtl, JSON.stringify(data));
        logger.debug('Cache SET', { key: fullKey, ttl: effectiveTtl });
    } catch (err) {
        metrics.errors++;
        logger.warn('Cache SET fallido', { error: err.message });
    }

    return data;
}

/**
 * Invalida un namespace incrementando su version.
 * Las claves antiguas expiran naturalmente por TTL.
 * O(1) — no recorre claves.
 */
async function invalidate(namespace) {
    const client = getRedis();
    try {
        metrics.invalidations++;
        const newVersion = await client.incr(`${namespace}:_version`);
        logger.debug('Cache invalidado (version bump)', { namespace, newVersion });
    } catch (err) {
        metrics.errors++;
        logger.warn('Cache invalidation fallida', { namespace, error: err.message });
    }
}

/** Retorna snapshot de métricas. */
function getMetrics() {
    return { ...metrics };
}

module.exports = { getOrSet, invalidate, getRedis, getMetrics };
