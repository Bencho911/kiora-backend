'use strict';

const inventoryRepository = require('../repositories/inventoryRepository');
const logger = require('../config/logger');
const directEmailService = require('./directEmailService');
const env = require('../config/env');
const redisService = require('./redisService');
const { createCircuitBreaker } = require('../utils/circuitBreaker');
const { outgoingHeaders, DEFAULT_TIMEOUT_MS } = require('../utils/httpClient');

/**
 * inventoryService
 * Capa de servicio que encapsula la lógica de negocio del inventario.
 * Responsable de la sincronización de stock con products-service.
 */

/* ── Circuit Breaker para products-service ────────────────────────────────── */

async function _putProductStock(url, body, headers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!res.ok) {
            const errBody = await res.text();
            const err = new Error(`Products responded with ${res.status}: ${errBody}`);
            err.status = res.status;
            err.body = errBody;
            throw err;
        }
        return res;
    } finally {
        clearTimeout(timer);
    }
}

const productsBreaker = createCircuitBreaker(
    _putProductStock,
    'products-service',
    { timeout: 10000, resetTimeout: 30000 }
);

/* ── Registrar movimiento + sincronizar stock ────────────────────────────── */

/**
 * Registra un movimiento y sincroniza con Suministra y ProductsService.
 * @param {Object} movementData 
 * @param {Object} reqHeaders - Encabezados originales para propagar
 */
async function registerMovement(movementData, reqHeaders) {
    const { tipo_mov, cantidad, cod_prod, fecha_mov, fk_cod_prov, fk_id_vent, desc_mov } = movementData;

    // Delta único: se usa tanto para Suministra como para products-service
    const stockDelta = tipo_mov === 'entrada' ? Number(cantidad) : -Number(cantidad);

    // 1. Guardar historial en tabla Inventario
    const result = await inventoryRepository.createMovement({
        tipo_mov, fecha_mov, cantidad, cod_prod, fk_cod_prov, fk_id_vent, desc_mov
    });
    const movement = result.rows[0];
    logger.info('Movimiento registrado', { id_mov: movement.id_mov, tipo_mov, cod_prod });

    // 2. Actualizar stock en Suministra + verificar alertas
    try {
        const stockRes = await inventoryRepository.updateStock(cod_prod, stockDelta, fk_cod_prov);
        
        if (stockRes && stockRes.rows.length > 0) {
            const row = stockRes.rows[0];
            if (row.stock < row.stock_minimo) {
                logger.warn('Stock bajo detectado. Enviando alerta...', { cod_prod, stock: row.stock });
                
                await directEmailService.sendLowStockEmail({
                    cod_prod,
                    stock_actual: row.stock,
                    stock_minimo: row.stock_minimo
                }, null); // Usa ALERT_EMAIL / ADMIN_EMAIL del .env

                await redisService.emitLowStockAlert({
                    cod_prod,
                    stock_actual: row.stock,
                    fk_cod_prov: row.fk_cod_prov
                });
            }
        }
    } catch (err) {
        logger.error('Error sincronizando con Suministra o enviando alerta', { error: err.message });
    }

    // 3. Sincronización reactiva con products-service vía circuit breaker
    const headers = outgoingHeaders(reqHeaders);
    const MAX_RETRIES = 3;
    let synced = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const syncRes = await productsBreaker.fire(
                `${env.productsServiceUrl}/api/products/${cod_prod}/stock`,
                { cantidad: stockDelta },
                headers
            );
            const stockData = await syncRes.json();
            logger.info('Stock sincronizado con products-service', {
                cod_prod, stock_actual: stockData.stock_actual, attempt,
            });
            synced = true;
            break;
        } catch (err) {
            if (err.status === 409) {
                logger.warn('Stock insuficiente en products-service', { cod_prod });
                break;
            }
            if (err.code === 'CIRCUIT_OPEN') {
                logger.error('Circuit breaker abierto, no se puede sincronizar stock', { cod_prod });
                break;
            }
            logger.warn(`Intento ${attempt}/${MAX_RETRIES}: fallo al sincronizar stock`, {
                cod_prod, error: err.message,
            });
        }

        if (attempt < MAX_RETRIES) {
            const delay = 500 * Math.pow(2, attempt - 1) * (0.5 + Math.random());
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    if (!synced) {
        logger.error('FALLO DEFINITIVO: No se pudo sincronizar stock', {
            cod_prod, id_mov: movement.id_mov,
        });
    }

    return movement;
}

module.exports = { registerMovement };
