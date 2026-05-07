'use strict';

const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

const pool = new Pool({
    user: env.db.user,
    host: env.db.host,
    database: env.db.name,
    password: env.db.password,
    port: env.db.port,
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', { error: err.message });
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
