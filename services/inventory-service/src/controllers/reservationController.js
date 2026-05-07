'use strict';

const redisService = require('../services/redisService');
const inventoryService = require('../services/inventoryService');
const env = require('../config/env');
const logger = require('../config/logger');

const reserveInventory = async (req, res) => {
    const { orderId, items } = req.body;
    
    if (!orderId || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Faltan parámetros orderId o items.' });
    }

    try {
        for (const item of items) {
            const prodRes = await fetch(`${env.productsServiceUrl}/api/products/${item.cod_prod}`);
            if (!prodRes.ok) {
                return res.status(404).json({ error: 'Producto ' + item.cod_prod + ' no encontrado en catálogo.' });
            }
            const productData = await prodRes.json();
            const pgStock = parseInt(productData.stock_actual || 0, 10);
            
            const reserved = await redisService.getReservedQuantityForProduct(item.cod_prod);
            const effectiveStock = pgStock - reserved;

            if (effectiveStock < item.cantidad) {
                return res.status(409).json({ 
                    error: '¡Agotado! Otro cliente apartó el producto ' + item.cod_prod + '. Quedan ' + effectiveStock + ' unidades disponibles en este momento.'
                });
            }
        }

        await redisService.lockInventory(orderId, items, 600);
        logger.info('Inventario bloqueado en Redis', { orderId });

        res.status(200).json({ message: 'Reserva exitosa.' });
    } catch (e) {
        logger.error('Fallo en reserveInventory', { error: e.message });
        res.status(500).json({ error: 'Error del servidor procesando reserva distribuida.' });
    }
};

const commitReservation = async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ error: 'Se requiere orderId' });
    }

    try {
        const items = await redisService.consumeLock(orderId);
        
        if (!items) {
            logger.warn('Intento de commit sobre reserva expirada', { orderId });
            return res.status(404).json({ error: 'Reserva no encontrada o ya expirada.' });
        }

        for (const item of items) {
            await inventoryService.registerMovement({
                tipo_mov: 'salida',
                cantidad: item.cantidad,
                cod_prod: item.cod_prod,
                fk_id_vent: Number(orderId),
                desc_mov: `VENTA SAGA #${orderId}`
            }, req.headers);
        }

        logger.info('Commit de reserva a movimientos finalizado', { orderId });
        res.status(200).json({ message: 'Inventario sustraído permanentemente.' });

    } catch (e) {
        logger.error('Error aplicando commitReservation', { error: e.message });
        res.status(500).json({ error: 'Error del servidor comiteando inventario.' });
    }
};

const rollbackReservation = async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ error: 'Se requiere orderId' });
    }

    try {
        await redisService.releaseLock(orderId);
        logger.info('Reserva liberada (rollback)', { orderId });
        res.status(200).json({ message: 'Reserva liberada exitosamente.' });
    } catch (e) {
        logger.error('Error aplicando rollbackReservation', { error: e.message });
        res.status(500).json({ error: 'Error del servidor liberando reserva.' });
    }
};

module.exports = { reserveInventory, commitReservation, rollbackReservation };
