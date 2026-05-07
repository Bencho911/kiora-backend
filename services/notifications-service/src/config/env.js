'use strict';

const REQUIRED_VARS = [
    'REDIS_HOST',
    'REDIS_PORT',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'FROM_EMAIL',
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
    port: Number(process.env.PORT) || 3005,
    redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD || undefined,
        notificationsChannel: process.env.REDIS_NOTIFICATIONS_CHANNEL || 'kiora:notifications',
        notificationsStream: process.env.REDIS_NOTIFICATIONS_STREAM || 'kiora:notifications:stream',
        consumerGroup: process.env.REDIS_CONSUMER_GROUP || 'kiora-notifications-group',
    },
    smtp: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        secure: process.env.SMTP_SECURE === 'true',
        from: process.env.FROM_EMAIL,
    },
    db: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        name: process.env.DB_NAME,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'rootpassword',
    },
    nodeEnv: process.env.NODE_ENV || 'development',
};
