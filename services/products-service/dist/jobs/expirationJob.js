"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const ioredis_1 = __importDefault(require("ioredis"));
const db_1 = __importDefault(require("../config/db"));
const logger_1 = __importDefault(require("../config/logger"));
const redisClient = process.env.REDIS_HOST
    ? new ioredis_1.default({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT) || 6379,
    })
    : null;
/**
 * Tarea programada que se ejecuta todos los días a la medianoche.
 * Busca productos donde fechaven_prod ya pasó y emite una alerta.
 */
// '0 0 * * *' = Medianoche
node_cron_1.default.schedule('0 0 * * *', async () => {
    logger_1.default.info('Iniciando job automático de revisión de caducidad de productos...');
    try {
        const result = await db_1.default.query("SELECT cod_prod, nom_prod, TO_CHAR(fechaven_prod, 'YYYY-MM-DD') as fecha FROM Producto WHERE fechaven_prod < CURRENT_DATE");
        if (result.rows.length > 0) {
            logger_1.default.info('Se encontraron ' + result.rows.length + ' productos caducados. Notificando asíncronamente...');
            if (redisClient) {
                const htmlList = result.rows.map((p) => '<li>' + p.nom_prod + ' (Venció: ' + p.fecha + ')</li>').join('');
                const payload = JSON.stringify({
                    to: process.env.ADMIN_EMAIL || 'admin@kiora.com',
                    subject: '⚠️ Alerta Automática: Productos Caducados',
                    html: '<h1>Revisión Diaria de Caducidad</h1><p>Los siguientes productos han expirado:</p><ul>' + htmlList + '</ul><p>Por favor comuníquese con inventario y retírelos del sistema.</p>'
                });
                await redisClient.xadd('kiora:notifications:stream', '*', 'payload', payload);
            }
        }
        else {
            logger_1.default.info('Ningún producto caducado encontrado hoy por el cron job.');
        }
    }
    catch (e) {
        logger_1.default.error('e', { error: e.message });
    }
});
exports.default = true;
