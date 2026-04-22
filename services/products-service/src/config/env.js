'use strict';

// Validación de variables de entorno al arrancar el servicio.
// Si falta alguna variable requerida, el proceso termina con código 1
// para evitar arrancar con una configuración incompleta.

const REQUIRED_VARS = [
    'DB_USER',
    'DB_PASSWORD',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);

if (missing.length > 0) {
    console.error(
        `[env] Faltan variables de entorno requeridas: ${missing.join(', ')}\n` +
        'Copia .env.example → .env.local y completa los valores.'
    );
    process.exit(1);
}

module.exports = {
    port: Number(process.env.PORT) || 3002,
    db: {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        name: process.env.DB_NAME,
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        cacheTtl: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 300, // 5 minutos
    },
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
};
