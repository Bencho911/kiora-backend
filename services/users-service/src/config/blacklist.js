const Redis = require('ioredis');
const logger = require('./logger');

const BLACKLIST_UNAVAILABLE = 'BLACKLIST_UNAVAILABLE';

const isBlacklistFailOpen = () => {
    const raw = process.env.BLACKLIST_FAIL_OPEN;
    if (raw === undefined || raw === '') return true;
    return !['false', '0', 'no', 'off'].includes(String(raw).toLowerCase());
};

const blacklistUnavailableError = (message) => {
    const err = new Error(message || 'Servicio de revocación de sesiones no disponible.');
    err.code = BLACKLIST_UNAVAILABLE;
    return err;
};

class InMemoryBlacklist {
    constructor() { this._set = new Set(); }
    async set(key) { this._set.add(key); }
    async exists(key) { return this._set.has(key) ? 1 : 0; }
    async clear() { this._set.clear(); }
    async quit() { }
}

let client;

if (process.env.NODE_ENV === 'test') {
    client = new InMemoryBlacklist();
} else {
    client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
    });

    client.on('error', (err) => {
        if (err.code !== 'ECONNREFUSED') {
            logger.error('Redis blacklist: error de conexión', { error: err.message });
        }
    });
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Extrae la firma (parte 3) del JWT y la clave Redis.
 * @param {string} token
 * @returns {string|null}
 */
const _key = (token) => {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return `bl:${parts[2]}`;
};

/**
 * Calcula los segundos restantes hasta que el JWT expire.
 * @param {string} token
 * @returns {number} TTL en segundos (mínimo 1)
 */
const _ttl = (token) => {
    try {
        const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64url').toString('utf-8')
        );
        const remaining = payload.exp - Math.floor(Date.now() / 1000);
        return Math.max(remaining, 1);
    } catch {
        return 600;
    }
};

/**
 * Agrega un token a la blacklist.
 * Redis lo eliminará automáticamente cuando el JWT expire.
 * @param {string} token - JWT completo
 */
const add = async (token) => {
    const key = _key(token);
    if (!key) return;
    try {
        const ttl = _ttl(token);
        if (process.env.NODE_ENV === 'test') {
            await client.set(key);
        } else {
            // SET bl:<firma> 1 EX <segundos>
            await client.set(key, '1', 'EX', ttl);
        }
    } catch (err) {
        if (!err.message.includes("Stream isn't writeable") && !err.message.includes("max retries")) {
            logger.error('Redis blacklist: error al agregar token', { error: err.message });
        }
        if (!isBlacklistFailOpen()) {
            throw blacklistUnavailableError();
        }
    }
};

/**
 * Verifica si un token está en la blacklist.
 * @param {string} token - JWT completo
 * @returns {Promise<boolean>}
 */
const has = async (token) => {
    const key = _key(token);
    if (!key) return false;
    try {
        const result = await client.exists(key);
        return result === 1;
    } catch (err) {
        if (!err.message.includes("Stream isn't writeable") && !err.message.includes("max retries")) {
            logger.error('Redis blacklist: error al verificar token', { error: err.message });
        }
        if (!isBlacklistFailOpen()) {
            throw blacklistUnavailableError();
        }
        return false;
    }
};

/**
 * Comprueba conectividad con Redis (readiness). En tests no hace nada.
 * @returns {Promise<void>}
 */
const ping = async () => {
    if (process.env.NODE_ENV === 'test') return;
    try {
        await client.ping();
    } catch (err) {
        if (!isBlacklistFailOpen()) {
            throw blacklistUnavailableError(err.message);
        }
        throw err;
    }
};

/**
 * Solo para tests: limpia el estado en memoria entre casos.
 */
const resetForTests = async () => {
    if (process.env.NODE_ENV === 'test' && typeof client.clear === 'function') {
        await client.clear();
    }
};

module.exports = {
    add,
    has,
    ping,
    client,
    resetForTests,
    BLACKLIST_UNAVAILABLE,
    isBlacklistFailOpen,
};
