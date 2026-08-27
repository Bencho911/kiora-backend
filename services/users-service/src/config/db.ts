import { Pool } from 'pg';
import './env';
import logger from './logger';

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    // ── Límites del pool ──────────────────────────────────────────────────
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '5000', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
});

pool.on('error', (err: any) => {
    logger.error('err', { error: (err as Error).message });
});

export default pool;