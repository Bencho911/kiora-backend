'use strict';
const Redis = require('ioredis');
const logger = require('../config/logger');

const redisClient = process.env.REDIS_HOST
    ? new Redis({
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT || 6379,
          retryStrategy: (times) => Math.min(times * 50, 2000),
      })
    : null;

if (redisClient) {
    redisClient.on('connect', () => logger.info('Conectado a Redis para Sistema de Reservas SAGA'));
    redisClient.on('error', (err) => logger.error('Error conectando a Redis', { error: err.message }));
}

const lockInventory = async (orderId, items, ttlSeconds = 600) => {
    if (!redisClient) throw new Error('Redis no configurado, modo degradado.');
    const key = 'reservation:order:' + orderId;
    await redisClient.set(key, JSON.stringify(items), 'EX', ttlSeconds);
    return key;
};

const consumeLock = async (orderId) => {
    if (!redisClient) return null;
    const key = 'reservation:order:' + orderId;
    const data = await redisClient.get(key);
    if (data) {
        await redisClient.del(key);
        return JSON.parse(data);
    }
    return null;
};

const getReservedQuantityForProduct = async (cod_prod) => {
    if (!redisClient) return 0;
    
    const keys = await redisClient.keys('reservation:order:*');
    if (keys.length === 0) return 0;

    let totalReserved = 0;
    const multi = redisClient.multi();
    keys.forEach(k => multi.get(k));
    const results = await multi.exec();

    results.forEach(([err, val]) => {
        if (!err && val) {
            const items = JSON.parse(val);
            const found = items.find(i => String(i.cod_prod) === String(cod_prod));
            if (found) {
                totalReserved += found.cantidad;
            }
        }
    });

    return totalReserved;
};

/**
 * Obtiene los correos de todos los administradores desde users-service
 */
const getAdminEmails = async () => {
    const baseUrl = process.env.USERS_SERVICE_URL || 'http://users-service:3001';
    try {
        const res = await fetch(`${baseUrl}/api/auth/users/admins`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.emails || [];
    } catch (err) {
        logger.warn('No se pudieron obtener correos de administradores (Redis)', { error: err.message });
        return [];
    }
};

/**
 * Dispara un evento asíncrono al sistema de notificaciones vía Streams
 * @param {Object} productData
 */
const emitLowStockAlert = async (productData) => {
    if (!redisClient) return;
    try {
        const streamKey = 'kiora:notifications:stream';
        const adminEmails = await getAdminEmails();
        const to = adminEmails.length > 0
            ? adminEmails.join(', ')
            : process.env.ALERT_EMAIL || 'admin@kiora.com';

        const payload = JSON.stringify({
            to,
            subject: '⚠️ Alerta: Stock Bajo Detectado en Kiosco',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f0eb; padding: 40px 20px; color: #333333;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(61,26,16,0.12);">
                        <div style="background-color: #3D1A10; padding: 28px 30px; text-align: center;">
                            <h1 style="color: #ffffff; font-size: 20px; font-weight: 900; margin: 0; letter-spacing: 1px;">KIORA INVENTORY SYSTEM</h1>
                        </div>
                        <div style="height: 4px; background: linear-gradient(to right, #C41E1E, #3D1A10);"></div>
                        <div style="padding: 40px 36px;">
                            <h2 style="color: #3D1A10; font-size: 22px; margin-top: 0; margin-bottom: 16px;">Alerta de Stock Crítico</h2>
                            <p style="font-size: 15px; line-height: 1.6; color: #555555; margin-top: 0;">
                                Hola,<br><br>
                                El sistema de monitoreo automático ha detectado un producto por debajo del nivel mínimo tras una operación en el Kiosco.
                            </p>
                            <div style="background-color: #fdf5f0; border-radius: 8px; border: 2px dashed #C41E1E; padding: 24px; margin: 24px 0;">
                                <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; color: #3D1A10; font-weight: bold; text-transform: uppercase;">Producto ID:</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: 900;">#${productData.cod_prod}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #3D1A10; font-weight: bold; text-transform: uppercase;">Stock Actual:</td>
                                        <td style="padding: 8px 0; text-align: right; color: #C41E1E; font-weight: 900; font-size: 18px;">${productData.stock_actual} unidades</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #3D1A10; font-weight: bold; text-transform: uppercase;">Proveedor:</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: 500;">Cod. #${productData.fk_cod_prov || 'N/A'}</td>
                                    </tr>
                                </table>
                            </div>
                            <p style="font-size: 14px; line-height: 1.5; color: #777777; font-style: italic; text-align: center;">
                                Por favor, reabastezca el inventario para evitar quiebres de stock en el punto de venta.
                            </p>
                            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
                            <p style="font-size: 12px; line-height: 1.5; color: #999999; margin-bottom: 0; text-align: center;">
                                Este es un correo automático generado vía Redis Streams. Por favor no respondas.
                            </p>
                        </div>
                        <div style="background-color: #3D1A10; padding: 14px 30px; text-align: center;">
                            <p style="color: #c8a898; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Kiora. Todos los derechos reservados.</p>
                        </div>
                    </div>
                </div>
            `
        });
        
        await redisClient.xadd(streamKey, '*', 'payload', payload);
        logger.info('Notificación de stock bajo enviada a Stream', { cod_prod: productData.cod_prod });
    } catch (e) {
        logger.error('Error enviando alerta de stock al stream', { error: e.message });
    }
};

const releaseLock = async (orderId) => {
    if (!redisClient) return;
    const key = 'reservation:order:' + orderId;
    await redisClient.del(key);
};

module.exports = {
    redisClient,
    lockInventory,
    consumeLock,
    releaseLock,
    getReservedQuantityForProduct,
    emitLowStockAlert
};
