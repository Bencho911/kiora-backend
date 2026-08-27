import cron from 'node-cron';
import axios from 'axios';
import logger from '../config/logger';
import { forceCloseSessionByCronIfNeeded } from '../controllers/sessionController';

export const startCronJobs = () => {
    // Se ejecuta cada minuto
    cron.schedule('* * * * *', async () => {
        try {
            const usersUrl = process.env.USERS_SERVICE_URL || 'http://users-service:3001';
            const res = await axios.get(`${usersUrl}/api/settings/internal`);
            const settings = res.data;

            if (!settings.cierre_caja_automatico || !settings.hora_cierre_automatico) return;

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
                await forceCloseSessionByCronIfNeeded(todayCloseLocal, tz);
            }
        } catch (error: unknown) {
            logger.error('error', { error: (error as Error).message });
        }
    });

    logger.info('Cron jobs inicializados en orders-service');
};
