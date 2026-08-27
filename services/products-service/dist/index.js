"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("./config/tracing");
const env_1 = __importDefault(require("./config/env"));
const logger_1 = __importDefault(require("./config/logger"));
const app_1 = __importDefault(require("./app"));
require("./jobs/expirationJob");
const server = app_1.default.listen(env_1.default.port, () => {
    logger_1.default.info(`products-service corriendo en el puerto ${env_1.default.port}`, {
        nodeEnv: env_1.default.nodeEnv,
        db: `${env_1.default.db.host}:${env_1.default.db.port}/${env_1.default.db.name}`,
    });
});
function shutdown(signal) {
    logger_1.default.info(`${signal} recibido — cerrando products-service...`);
    server.close(() => {
        logger_1.default.info('products-service cerrado correctamente');
        process.exit(0);
    });
    setTimeout(() => { logger_1.default.error('Forzando cierre'); process.exit(1); }, 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
