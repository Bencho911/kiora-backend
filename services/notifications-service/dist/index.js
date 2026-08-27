'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
const env_js_1 = __importDefault(require("./config/env.js"));
const logger_js_1 = __importDefault(require("./config/logger.js"));
const app_js_1 = __importDefault(require("./app.js"));
const emailService_js_1 = require("./services/emailService.js");
const notificationSubscriber_js_1 = require("./services/notificationSubscriber.js");
// Inicializar Nodemailer con la config SMTP
(0, emailService_js_1.initTransporter)(env_js_1.default.smtp);
// Arrancar el subscriber Redis para recibir eventos de notificación
(0, notificationSubscriber_js_1.startSubscriber)(env_js_1.default.redis, env_js_1.default.smtp.from);
// Levantar el servidor HTTP (health-check + futuros endpoints REST)
app_js_1.default.listen(env_js_1.default.port, () => {
    logger_js_1.default.info(`notifications-service corriendo en el puerto ${env_js_1.default.port}`, {
        nodeEnv: env_js_1.default.nodeEnv,
        redisChannel: env_js_1.default.redis.notificationsChannel,
    });
});
