import cron from 'node-cron';
import Redis from 'ioredis';
import db from '../config/db';
import logger from '../config/logger';

const redisClient = process.env.REDIS_HOST
    ? new Redis({
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT) || 6379,
      })
    : null;

/**
 * Tarea programada que se ejecuta todos los días a la medianoche.
 * Busca productos donde fechaven_prod ya pasó y emite una alerta.
 */
// '0 0 * * *' = Medianoche
cron.schedule('0 0 * * *', async () => {
    logger.info('Iniciando job automático de revisión de caducidad de productos...');
    try {
        const result = await db.query(
            "SELECT cod_prod, nom_prod, TO_CHAR(fechaven_prod, 'YYYY-MM-DD') as fecha FROM Producto WHERE fechaven_prod < CURRENT_DATE"
        );
        
        if (result.rows.length > 0) {
            logger.info('Se encontraron ' + result.rows.length + ' productos caducados. Notificando asíncronamente...');
            
            if (redisClient) {
                const htmlList = result.rows.map((p: any) => '<li>' + p.nom_prod + ' (Venció: ' + p.fecha + ')</li>').join('');
                const payload = JSON.stringify({
                    to: process.env.ADMIN_EMAIL || 'admin@kiora.com',
                    subject: '⚠️ Alerta Automática: Productos Caducados',
                    html: '<h1>Revisión Diaria de Caducidad</h1><p>Los siguientes productos han expirado:</p><ul>' + htmlList + '</ul><p>Por favor comuníquese con inventario y retírelos del sistema.</p>'
                });
                
                await redisClient.xadd('kiora:notifications:stream', '*', 'payload', payload);
            }
        } else {
            logger.info('Ningún producto caducado encontrado hoy por el cron job.');
        }
    } catch (e: unknown) {
        logger.error('e', { error: (e as Error).message });
    }
});

export default true;
