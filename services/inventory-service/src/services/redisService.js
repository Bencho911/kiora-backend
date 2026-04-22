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
 * Dispara un evento asíncrono al sistema de notificaciones vía Streams
 * @param {Object} productData 
 */
const emitLowStockAlert = async (productData) => {
    if (!redisClient) return;
    try {
        const streamKey = 'kiora:notifications:stream';
        const payload = JSON.stringify({
            to: process.env.ADMIN_EMAIL || 'admin@kiora.com',
            subject: '⚠️ Alerta: Stock Bajo Detectado en Kiosco',
            html: '<h1>Alerta de Inventario</h1>' +
                  '<p>El siguiente producto ha caído por debajo de su stock mínimo de seguridad tras una compra en el Kiosco:</p>' +
                  '<ul>' +
                  '<li><strong>Producto ID:</strong> ' + productData.cod_prod + '</li>' +
                  '<li><strong>Stock Actual:</strong> ' + productData.stock_actual + '</li>' +
                  '<li><strong>Proveedor ID:</strong> ' + productData.fk_cod_prov + '</li>' +
                  '</ul>' +
                  '<p>Por favor, reabastezca el inventario a la brevedad.</p>'
        });
        
        await redisClient.xadd(streamKey, '*', 'payload', payload);
        logger.info('Notificación de stock bajo enviada a Stream', { cod_prod: productData.cod_prod });
    } catch (e) {
        logger.error('Error enviando alerta de stock al stream', { error: e.message });
    }
};

module.exports = {
    redisClient,
    lockInventory,
    consumeLock,
    getReservedQuantityForProduct,
    emitLowStockAlert
};
