'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
exports.getOrSet = getOrSet;
exports.invalidate = invalidate;
exports.getMetrics = getMetrics;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = __importDefault(require("../config/logger"));
const env_1 = __importDefault(require("../config/env"));
let redis = null;
const metrics = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    errors: 0,
};
function getRedis() {
    if (redis)
        return redis;
    redis = new ioredis_1.default({
        host: env_1.default.redis.host,
        port: env_1.default.redis.port,
        password: env_1.default.redis.password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
            if (times > 3)
                return null;
            return Math.min(times * 200, 2000);
        },
    });
    redis.on('connect', () => logger_1.default.info('Redis cache conectado'));
    redis.on('error', (err) => logger_1.default.warn('Redis cache error', { error: err.message }));
    redis.connect().catch(() => {
        logger_1.default.warn('No se pudo conectar a Redis cache — el servicio funcionará sin cache');
    });
    return redis;
}
async function getVersion(namespace) {
    const client = getRedis();
    try {
        let v = await client.get(`${namespace}:_version`);
        if (!v) {
            await client.set(`${namespace}:_version`, '1');
            v = '1';
        }
        return v;
    }
    catch (err) {
        return '0';
    }
}
async function getOrSet(namespace, subkey, fetchFn, ttl) {
    const client = getRedis();
    const effectiveTtl = ttl || env_1.default.redis.cacheTtl;
    try {
        const version = await getVersion(namespace);
        const fullKey = `${namespace}:v${version}:${subkey}`;
        const cached = await client.get(fullKey);
        if (cached) {
            metrics.hits++;
            logger_1.default.debug('Cache HIT', { key: fullKey });
            return JSON.parse(cached);
        }
        metrics.misses++;
    }
    catch (err) {
        metrics.errors++;
        logger_1.default.warn('Cache GET fallido, consultando BD', { error: err.message });
    }
    const data = await fetchFn();
    try {
        const version = await getVersion(namespace);
        const fullKey = `${namespace}:v${version}:${subkey}`;
        await client.setex(fullKey, effectiveTtl, JSON.stringify(data));
        logger_1.default.debug('Cache SET', { key: fullKey, ttl: effectiveTtl });
    }
    catch (err) {
        metrics.errors++;
        logger_1.default.warn('Cache SET fallido', { error: err.message });
    }
    return data;
}
async function invalidate(namespace) {
    const client = getRedis();
    try {
        metrics.invalidations++;
        const newVersion = await client.incr(`${namespace}:_version`);
        logger_1.default.debug('Cache invalidado (version bump)', { namespace, newVersion });
    }
    catch (err) {
        metrics.errors++;
        logger_1.default.warn('Cache invalidation fallida', { namespace, error: err.message });
    }
}
function getMetrics() {
    return { ...metrics };
}
exports.default = { getOrSet, invalidate, getRedis, getMetrics };
