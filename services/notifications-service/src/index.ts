'use strict';

import dotenv from 'dotenv';
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });

import env from './config/env.js';
import logger from './config/logger.js';
import app from './app.js';
import { initTransporter  } from './services/emailService.js';
import { startSubscriber  } from './services/notificationSubscriber.js';

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
