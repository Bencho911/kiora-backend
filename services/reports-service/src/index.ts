import dotenv from 'dotenv';
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
import './config/env';  // Valida variables de entorno antes de arrancar
import app from './app.js';
import { logger } from '@kiora/shared';

import { createTables } from './config/setupDb';
import { startReportsWorker } from './workers/reportsWorker';
import { runBackfill } from './scripts/backfill';

const port = process.env.PORT || 3006;

async function bootstrap() {
    // 1. Inicializar Tablas
    await createTables();
    
    // 2. Iniciar Worker CQRS
    startReportsWorker();

    // 3. Sincronización Inicial (Fire & Forget)
    runBackfill();

    app.listen(port, () => {
        logger.info(`reports-service corriendo en el puerto ${port}`);
    });
}

bootstrap().catch(err => {
    logger.error('Error arrancando reports-service', { error: err.message });
    process.exit(1);
});
