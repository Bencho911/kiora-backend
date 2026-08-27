"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../config/logger"));
const sessionController_1 = require("../controllers/sessionController");
const startCronJobs = () => {
    // Se ejecuta cada minuto
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            const usersUrl = process.env.USERS_SERVICE_URL || 'http://users-service:3001';
            const res = await axios_1.default.get(`${usersUrl}/api/settings/internal`);
            const settings = res.data;
            if (!settings.cierre_caja_automatico || !settings.hora_cierre_automatico)
                return;
            const tz = process.env.TZ || 'America/Bogota';
            // Hora local actual
            const localNow = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
            const [closeHour, closeMinute] = settings.hora_cierre_automatico.split(':').map(Number);
            // Construir la hora de cierre de HOY en zona local
            const todayCloseLocal = new Date(localNow);
            todayCloseLocal.setHours(closeHour, closeMinute, 0, 0);
            // ¿Ya pasó la hora de cierre de hoy?
            if (localNow >= todayCloseLocal) {
                // Pasar la hora de cierre al controller para que compare con la apertura de la sesión
                await (0, sessionController_1.forceCloseSessionByCronIfNeeded)(todayCloseLocal, tz);
            }
        }
        catch (error) {
            logger_1.default.error('error', { error: error.message });
        }
    });
    logger_1.default.info('Cron jobs inicializados en orders-service');
};
exports.startCronJobs = startCronJobs;
