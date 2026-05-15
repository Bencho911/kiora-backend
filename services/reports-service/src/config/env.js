'use strict';

const REQUIRED_VARS = [
    'ORDERS_SERVICE_URL',
];

const FACTUS_OPTIONAL_VARS = [
    'FACTUS_API_URL',
    'FACTUS_CLIENT_ID',
    'FACTUS_CLIENT_SECRET',
    'FACTUS_USERNAME',
    'FACTUS_PASSWORD',
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);

if (missing.length > 0) {
    console.error(
        `[env] Faltan variables de entorno requeridas: ${missing.join(', ')}\n` +
        'Copia .env.example → .env.local y completa los valores.'
    );
    process.exit(1);
}

const factusConfigured = FACTUS_OPTIONAL_VARS.every((v) => process.env[v] && !process.env[v].startsWith('tu_'));

if (!factusConfigured) {
    console.warn(
        '[env] Factus (facturacion electronica) no configurado — se usaran datos simulados.\n' +
        '  Define FACTUS_CLIENT_ID, FACTUS_CLIENT_SECRET, FACTUS_USERNAME y FACTUS_PASSWORD\n' +
        '  en .env.docker o .env.local para activar facturacion real.'
    );
}

module.exports = {
    port: Number(process.env.PORT) || 3006,
    ordersServiceUrl: process.env.ORDERS_SERVICE_URL,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
    factus: {
        apiUrl: process.env.FACTUS_API_URL || 'https://api-sandbox.factus.com.co',
        clientId: process.env.FACTUS_CLIENT_ID,
        clientSecret: process.env.FACTUS_CLIENT_SECRET,
        username: process.env.FACTUS_USERNAME,
        password: process.env.FACTUS_PASSWORD,
        configured: factusConfigured,
    },
};
