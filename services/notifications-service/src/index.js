'use strict';

require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });

const env    = require('./config/env');
const logger = require('./config/logger');
const app    = require('./app');
const { initTransporter }  = require('./services/emailService');
const { startSubscriber }  = require('./services/notificationSubscriber');

// Inicializar Nodemailer con la config SMTP
initTransporter(env.smtp);

// Arrancar el subscriber Redis para recibir eventos de notificación
startSubscriber(env.redis, env.smtp.from);

// Levantar el servidor HTTP (health-check + futuros endpoints REST)
app.listen(env.port, () => {
    logger.info(`notifications-service corriendo en el puerto ${env.port}`, {
        nodeEnv: env.nodeEnv,
        redisChannel: env.redis.notificationsChannel,
    });
});
