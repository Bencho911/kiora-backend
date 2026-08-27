'use strict';

import { Pool } from 'pg';
import logger from './logger';

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    // ── Límites del pool ──────────────────────────────────────────────────
    max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS, 10) || 5000,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
});

pool.on('error', (err) => {
    logger.error('err', { error: (err as Error).message });
});

export default pool;
