'use strict';

const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

const pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    database: env.db.name,
    user: env.db.user,
    password: env.db.password,
    max: 10,
    idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
    logger.error('Error inesperado en cliente de base de datos de notificaciones', { error: err.message });
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
};
