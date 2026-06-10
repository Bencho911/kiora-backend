const cron = require('node-cron');
const axios = require('axios');
const logger = require('../config/logger');
const { forceCloseSessionByCron } = require('../controllers/sessionController');

const startCronJobs = () => {
    // Se ejecuta cada minuto
    cron.schedule('* * * * *', async () => {
        try {
            const usersUrl = process.env.USERS_SERVICE_URL || 'http://users-service:3001';
            const res = await axios.get(`${usersUrl}/api/settings/internal`);
            const settings = res.data;

            if (settings.cierre_caja_automatico && settings.hora_cierre_automatico) {
                const now = new Date();
                const currentHour = now.getHours().toString().padStart(2, '0');
                const currentMinute = now.getMinutes().toString().padStart(2, '0');
                const currentTime = `${currentHour}:${currentMinute}`;
                
                // Si la hora actual es exactamente igual a la configurada, forzamos cierre
                // Como esto corre cada minuto, solo entrará una vez al día.
                if (currentTime === settings.hora_cierre_automatico) {
                    logger.info(`Iniciando cierre automático de caja programado a las ${currentTime}`);
                    await forceCloseSessionByCron();
                }
            }
        } catch (error) {
            logger.error('Error en el cron job de cierre de caja', { error: error.message });
        }
    });
    
    logger.info('Cron jobs inicializados en orders-service');
};

module.exports = { startCronJobs };
