import dotenv from 'dotenv';
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
import './config/tracing';

import { env } from './config/env';
import logger from './config/logger';
import app from './app';

const server = app.listen(env.port, () => {
    logger.info(`stores-service corriendo en el puerto ${env.port}`, {
        nodeEnv: env.nodeEnv,
        db: `${env.db.host}:${env.db.port}/${env.db.name}`,
    });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
function shutdown(signal: string) {
    logger.info(`${signal} recibido — cerrando stores-service...`);
    server.close(() => {
        logger.info('stores-service cerrado correctamente');
        process.exit(0);
    });
    setTimeout(() => { logger.error('Forzando cierre'); process.exit(1); }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
