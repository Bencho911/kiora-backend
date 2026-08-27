"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
require("./config/tracing");
const env_1 = __importDefault(require("./config/env"));
const logger_1 = __importDefault(require("./config/logger"));
const app_1 = __importDefault(require("./app"));
const outboxPoller_1 = require("./services/outboxPoller");
const cronJobs_1 = require("./jobs/cronJobs");
const server = app_1.default.listen(env_1.default.port, () => {
    logger_1.default.info(`orders-service corriendo en el puerto ${env_1.default.port}`, {
        nodeEnv: env_1.default.nodeEnv,
        db: `${env_1.default.db.host}:${env_1.default.db.port}/${env_1.default.db.name}`,
    });
    // Iniciar el poller del Outbox Pattern
    (0, outboxPoller_1.startPoller)();
    // Iniciar cron jobs (Cierre de caja automático)
    (0, cronJobs_1.startCronJobs)();
});
// ── Graceful shutdown ─────────────────────────────────────────────────────
function shutdown(signal) {
    logger_1.default.info(`${signal} recibido — cerrando orders-service...`);
    server.close(() => {
        logger_1.default.info('orders-service cerrado correctamente');
        process.exit(0);
    });
    setTimeout(() => { logger_1.default.error('Forzando cierre'); process.exit(1); }, 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
