'use strict';

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
    port: Number(process.env.PORT) || 3004,
    db: {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        name: process.env.DB_NAME,
    },
    usersServiceUrl: process.env.USERS_SERVICE_URL || 'http://localhost:3001',
    inventoryServiceUrl: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
};
