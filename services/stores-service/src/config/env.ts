// Validación de variables de entorno al arrancar el servicio.
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

export const env = {
    port: Number(process.env.PORT) || 3009,
    db: {
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        host: process.env.DB_HOST!,
        port: Number(process.env.DB_PORT),
        name: process.env.DB_NAME!,
    },
    corsOrigin: process.env.CORS_ORIGIN || '*',
    nodeEnv: process.env.NODE_ENV || 'development',
};
