'use strict';

import { Pool  } from 'pg';
import env from './env.js';
import logger from './logger.js';

const pool = new Pool({
    user: env.db.user,
    host: env.db.host,
    database: env.db.name,
    password: env.db.password,
    port: env.db.port,
});

pool.on('error', (err) => {
    logger.error('err', { error: (err as Error).message });
    process.exit(-1);
});

export default {
    query: (text, params) => pool.query(text, params),
    pool,
};
