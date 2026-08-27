import dotenv from 'dotenv';
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
import './config/env';  // Valida variables de entorno antes de arrancar
import app from './app.js';
import logger from './config/logger.js';

const port = process.env.PORT || 3006;

app.listen(port, () => {
    logger.info(`reports-service corriendo en el puerto ${port}`);
});
