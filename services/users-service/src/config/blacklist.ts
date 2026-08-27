import Redis from 'ioredis';
import logger from './logger';

export const BLACKLIST_UNAVAILABLE = 'BLACKLIST_UNAVAILABLE';

export const isBlacklistFailOpen = () => {
    const raw = process.env.BLACKLIST_FAIL_OPEN;
    if (raw === undefined || raw === '') return true;
    return !['false', '0', 'no', 'off'].includes(String(raw).toLowerCase());
};

const blacklistUnavailableError = (message?: string) => {
    const err: any = new Error(message || 'Servicio de revocación de sesiones no disponible.');
    err.code = BLACKLIST_UNAVAILABLE;
    return err;
};

class InMemoryBlacklist {
    private _set = new Set<string>();
    async set(key: string) { this._set.add(key); }
    async exists(key: string) { return this._set.has(key) ? 1 : 0; }
    async clear() { this._set.clear(); }
    async quit() { }
}

export let client: any;

if (process.env.NODE_ENV === 'test') {
    client = new InMemoryBlacklist();
} else {
    client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        lazyConnect: false,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
    });

    client.on('error', (err: any) => {
        if (err.code !== 'ECONNREFUSED') {
            logger.error('Redis blacklist: error de conexión', { error: (err as Error).message });
        }
    });
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Extrae la firma (parte 3) del JWT y la clave Redis.
 */
const _key = (token: string) => {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return `bl:${parts[2]}`;
};

/**
 * Calcula los segundos restantes hasta que el JWT expire.
 */
const _ttl = (token: string) => {
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
 */
export const add = async (token: string) => {
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
    } catch (err: unknown) {
        if (!(err as Error).message.includes("Stream isn't writeable") && !(err as Error).message.includes("max retries")) {
            logger.error('Redis blacklist: error al agregar token', { error: (err as Error).message });
        }
        if (!isBlacklistFailOpen()) {
            throw blacklistUnavailableError();
        }
    }
};

/**
 * Verifica si un token está en la blacklist.
 */
export const has = async (token: string) => {
    const key = _key(token);
    if (!key) return false;
    try {
        const result = await client.exists(key);
        return result === 1;
    } catch (err: unknown) {
        if (!(err as Error).message.includes("Stream isn't writeable") && !(err as Error).message.includes("max retries")) {
            logger.error('Redis blacklist: error al verificar token', { error: (err as Error).message });
        }
        if (!isBlacklistFailOpen()) {
            throw blacklistUnavailableError();
        }
        return false;
    }
};

/**
 * Comprueba conectividad con Redis (readiness).
 */
export const ping = async () => {
    if (process.env.NODE_ENV === 'test') return;
    try {
        await client.ping();
    } catch (err: unknown) {
        if (!isBlacklistFailOpen()) {
            throw blacklistUnavailableError((err as Error).message);
        }
        throw err;
    }
};

/**
 * Solo para tests: limpia el estado en memoria entre casos.
 */
export const resetForTests = async () => {
    if (process.env.NODE_ENV === 'test' && typeof client.clear === 'function') {
        await client.clear();
    }
};
