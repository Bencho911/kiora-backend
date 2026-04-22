'use strict';

const db = require('../config/db');
const redisService = require('../services/redisService');
const inventoryRepository = require('../repositories/inventoryRepository');
const logger = require('../config/logger');

const reserveInventory = async (req, res) => {
    const { orderId, items } = req.body;
    
    if (!orderId || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Faltan parámetros orderId o items.' });
    }

    try {
        for (const item of items) {
            const pgResult = await db.query(
                'SELECT SUM(stock) as total_stock FROM Suministra WHERE cod_prod = $1', 
                [item.cod_prod]
            );
            const pgStock = parseInt(pgResult.rows[0].total_stock || 0, 10);
            
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
            // 1. Registrar movimiento de salida
            await inventoryRepository.createMovement({
                tipo_mov: 'salida',
                cantidad: item.cantidad,
                cod_prod: item.cod_prod,
                fk_id_vent: Number(orderId),
                desc_mov: `VENTA SAGA #${orderId}`
            });

            // 2. Descontar de Suministra para disparar alertas
            const stockUpdateRes = await inventoryRepository.updateStock(item.cod_prod, -item.cantidad);
            
            if (stockUpdateRes.rows.length > 0) {
                const row = stockUpdateRes.rows[0];
                if (row.stock <= row.stock_minimo) {
                    await redisService.emitLowStockAlert({
                        cod_prod: item.cod_prod,
                        stock_actual: row.stock,
                        fk_cod_prov: row.fk_cod_prov
                    });
                }
            }
        }

        logger.info('Commit de reserva a movimientos finalizado', { orderId });
        res.status(200).json({ message: 'Inventario sustraído permanentemente.' });

    } catch (e) {
        logger.error('Error aplicando commitReservation', { error: e.message });
        res.status(500).json({ error: 'Error del servidor comiteando inventario.' });
    }
};

module.exports = { reserveInventory, commitReservation };
