import dotenv from 'dotenv';
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
import './config/tracing';

import env from './config/env';
import logger from './config/logger';
import app from './app';
import { startPoller } from './services/outboxPoller';
import { startCronJobs } from './jobs/cronJobs';

const server = app.listen(env.port, () => {
    logger.info(`orders-service corriendo en el puerto ${env.port}`, {
        nodeEnv: env.nodeEnv,
        db: `${env.db.host}:${env.db.port}/${env.db.name}`,
    });

    // Iniciar el poller del Outbox Pattern
    startPoller();

    // Iniciar cron jobs (Cierre de caja automático)
    startCronJobs();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
function shutdown(signal: string) {
    logger.info(`${signal} recibido — cerrando orders-service...`);
    server.close(() => {
        logger.info('orders-service cerrado correctamente');
        process.exit(0);
    });
    setTimeout(() => { logger.error('Forzando cierre'); process.exit(1); }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
