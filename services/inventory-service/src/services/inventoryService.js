'use strict';

const inventoryRepository = require('../repositories/inventoryRepository');
const logger = require('../config/logger');
const env = require('../config/env');
const { createCircuitBreaker } = require('../utils/circuitBreaker');
const { outgoingHeaders } = require('../utils/httpClient');

/**
 * inventoryService
 * Capa de servicio que encapsula la lógica de negocio del inventario.
 * Responsable de la sincronización de stock con products-service.
 */

/* ── Circuit Breaker para products-service ────────────────────────────────── */

async function _putProductStock(url, body, headers) {
    const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errBody = await res.text();
        const err = new Error(`Products responded with ${res.status}: ${errBody}`);
        err.status = res.status;
        err.body = errBody;
        throw err;
    }
    return res;
}

const productsBreaker = createCircuitBreaker(
    _putProductStock,
    'products-service',
    { timeout: 10000, resetTimeout: 30000 }
);

/* ── Registrar movimiento + sincronizar stock ────────────────────────────── */

/**
 * Registra un movimiento de inventario y sincroniza el stock con products-service.
 *
 * @param {{ tipo_mov, cantidad, cod_prod, fecha_mov?, fk_cod_prov?, fk_id_vent? }} data
 * @param {object} reqHeaders — Headers del request original
 * @returns {object} Movimiento registrado
 */
async function registerMovement(data, reqHeaders) {
    const { tipo_mov, cantidad, cod_prod, fecha_mov, fk_cod_prov, fk_id_vent } = data;

    // 1. Guardar historial en tabla Inventario
    const result = await inventoryRepository.createMovement({
        tipo_mov, fecha_mov, cantidad, cod_prod, fk_cod_prov, fk_id_vent,
    });
    const movement = result.rows[0];
    logger.info('Movimiento registrado', { id_mov: movement.id_mov, tipo_mov, cod_prod });

    // 2. Sincronización reactiva con products-service vía circuit breaker
    const stockDelta = tipo_mov === 'entrada' ? Number(cantidad) : -Number(cantidad);
    const headers = outgoingHeaders(reqHeaders);

    const MAX_RETRIES = 3;
    let synced = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const stockRes = await productsBreaker.fire(
                `${env.productsServiceUrl}/api/products/${cod_prod}/stock`,
                { cantidad: stockDelta },
                headers
            );
            const stockData = await stockRes.json();
            logger.info('Stock sincronizado con products-service', {
                cod_prod, stock_actual: stockData.stock_actual, attempt,
            });
            synced = true;
            break;
        } catch (err) {
            // Si es 409 (stock insuficiente) es error de negocio, no reintentar
            if (err.status === 409) {
                logger.warn('Stock insuficiente en products-service', { cod_prod });
                break;
            }
            // Si el circuit breaker está abierto, no reintentar
            if (err.code === 'CIRCUIT_OPEN') {
                logger.error('Circuit breaker abierto, no se puede sincronizar stock', { cod_prod });
                break;
            }
            logger.warn(`Intento ${attempt}/${MAX_RETRIES}: fallo al sincronizar stock`, {
                cod_prod, error: err.message,
            });
        }

        if (attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
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
