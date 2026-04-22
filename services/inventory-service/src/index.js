'use strict';

require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
require('./config/tracing');

const env    = require('./config/env');
const logger = require('./config/logger');
const app    = require('./app');

const server = app.listen(env.port, () => {
    logger.info(`inventory-service corriendo en el puerto ${env.port}`, {
        nodeEnv: env.nodeEnv,
        db: `${env.db.host}:${env.db.port}/${env.db.name}`,
    });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
function shutdown(signal) {
    logger.info(`${signal} recibido — cerrando inventory-service...`);
    server.close(() => {
        logger.info('inventory-service cerrado correctamente');
        process.exit(0);
    });
    setTimeout(() => { logger.error('Forzando cierre'); process.exit(1); }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
