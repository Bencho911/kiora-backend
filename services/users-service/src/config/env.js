const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const resolveEnvPath = () => {
    if (process.env.ENV_FILE) {
        return process.env.ENV_FILE;
    }

    const localEnvPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(localEnvPath)) {
        return localEnvPath;
    }

    return path.resolve(process.cwd(), '.env');
};

require('dotenv').config({ path: resolveEnvPath() });

/**
 * env.js
 * Valida que todas las variables de entorno requeridas existan al arrancar.
 * Si falta alguna, el servidor no inicia y se muestra un error claro.
 */
const REQUIRED_ENV_VARS = [
    'DB_USER',
    'DB_PASSWORD',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
    logger.error('Variables de entorno faltantes', { missing });
    process.exit(1);
}

logger.info('Variables de entorno validadas correctamente');
