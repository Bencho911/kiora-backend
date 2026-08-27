import 'dotenv/config';
import './config/tracing';

import env from './config/env';
import logger from './config/logger';
import app from './app';
import './jobs/expirationJob';

const server = app.listen(env.port, () => {
    logger.info(`products-service corriendo en el puerto ${env.port}`, {
        nodeEnv: env.nodeEnv,
        db: `${env.db.host}:${env.db.port}/${env.db.name}`,
    });
});

function shutdown(signal: string) {
    logger.info(`${signal} recibido — cerrando products-service...`);
    server.close(() => {
        logger.info('products-service cerrado correctamente');
        process.exit(0);
    });
    setTimeout(() => { logger.error('Forzando cierre'); process.exit(1); }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
