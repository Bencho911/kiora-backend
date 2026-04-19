'use strict';

const orderRepository = require('../repositories/orderRepository');
const logger = require('../config/logger');
const env = require('../config/env');
const { createCircuitBreaker } = require('../utils/circuitBreaker');
const { outgoingHeaders, fetchWithRetry } = require('../utils/httpClient');

/**
 * orderService
 * Capa de servicio que encapsula la lógica de negocio de órdenes.
 * Responsable de la Saga de completar venta y la comunicación con inventory-service.
 */

/* ── Circuit Breaker para inventory-service ──────────────────────────────── */

async function _postInventoryMovement(url, body, headers) {
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errBody = await res.text();
        const err = new Error(`Inventory responded with ${res.status}: ${errBody}`);
        err.status = res.status;
        err.body = errBody;
        throw err;
    }
    return res;
}

const inventoryBreaker = createCircuitBreaker(
    _postInventoryMovement,
    'inventory-service',
    { timeout: 2000, resetTimeout: 30000 }
);

/* ── Crear orden ─────────────────────────────────────────────────────────── */

/**
 * Crea una venta con sus ítems.
 * @param {{ id_usu: number, metodopago_usu?: string, items: Array }} data
 */
async function createOrder(data) {
    const order = await orderRepository.createWithItems(data);
    logger.info('Venta creada', { id_vent: order.id_vent, id_usu: data.id_usu });
    return order;
}

/* ── Saga: completar venta ───────────────────────────────────────────────── */

/**
 * Completa una venta ejecutando la Saga de descuento de inventario.
 * 1. Obtiene los ítems de la venta
 * 2. Descuenta stock por cada ítem vía inventory-service
 * 3. Si falla un ítem, compensa (revierte) los ítems ya procesados
 * 4. Si todo OK, actualiza el estado en BD
 *
 * @param {number} orderId
 * @param {object} reqHeaders — Headers del request original (para correlation-id)
 */
async function completeOrder(orderId, reqHeaders) {
    const order = await orderRepository.findByIdWithItems(orderId);
    if (!order) return { error: 'Venta no encontrada.', status: 404 };

    // ── Idempotencia: si ya fue completada, no reprocessar ──
    if (order.estado === 'completada') {
        logger.warn('Saga: orden ya completada, ignorando (idempotente)', { orderId });
        return { ok: true, data: order, idempotent: true };
    }

    if (order.estado !== 'pendiente') {
        return {
            error: `No se puede completar una venta con estado '${order.estado}'.`,
            code: 'INVALID_STATE_TRANSITION',
            status: 409,
        };
    }

    if (!order.items || order.items.length === 0) {
        const result = await orderRepository.updateStatus(orderId, 'completada');
        return { ok: true, data: result.rows[0] };
    }

    const headers = outgoingHeaders(reqHeaders);
    const exitosos = [];
    let inventoryFailed = false;
    let errorDetails = null;

    // Paso 1: Descontar stock por cada ítem
    for (const item of order.items) {
        try {
            await inventoryBreaker.fire(
                `${env.inventoryServiceUrl}/api/inventory/movements`,
                {
                    tipo_mov: 'salida',
                    cantidad: item.cantidad,
                    cod_prod: item.cod_prod,
                    fk_id_vent: Number(orderId),
                },
                headers
            );
            exitosos.push(item);
            logger.info('Stock restado', { cod_prod: item.cod_prod, orderId });
        } catch (err) {
            inventoryFailed = true;
            errorDetails = err.body || err.message;
            logger.warn('Fallo stock para un item', {
                cod_prod: item.cod_prod,
                status: err.status,
                error: errorDetails,
            });
            break;
        }
    }

    // Paso 2: SAGA COMPENSACIÓN si falló
    if (inventoryFailed) {
        logger.warn('⚠️ SAGA: Iniciando rollback de inventario', { itemsRevertir: exitosos.length });

        for (const reg of exitosos) {
            try {
                await fetchWithRetry(
                    `${env.inventoryServiceUrl}/api/inventory/movements`,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            tipo_mov: 'entrada',
                            cantidad: reg.cantidad,
                            cod_prod: reg.cod_prod,
                            fk_id_vent: Number(orderId),
                            observaciones: 'COMPENSACION SAGA: FALLO DE ORDEN',
                        }),
                    },
                    { maxRetries: 3 }
                );
                logger.info('✅ SAGA: Producto devuelto', { cod_prod: reg.cod_prod });
            } catch (e) {
                logger.error('CRÍTICO: Falló la compensación SAGA', {
                    cod_prod: reg.cod_prod,
                    err: e.message,
                });
            }
        }

        return {
            error: 'Inventario insuficiente o servicio caído. Orden revertida automáticamente.',
            code: 'SAGA_ROLLBACK',
            details: errorDetails,
            status: 500,
        };
    }

    // Paso 3: Todo OK — actualizar estado en BD
    const result = await orderRepository.updateStatus(orderId, 'completada');
    logger.info('Estado de venta consolidado', { id_vent: orderId, estado: 'completada' });
    return { ok: true, data: result.rows[0] };
}

/* ── Actualizar estado genérico ──────────────────────────────────────────── */

/**
 * Actualiza el estado de una venta. Si es 'completada', ejecuta la Saga.
 */
async function updateStatus(orderId, estado, reqHeaders) {
    if (estado === 'completada') {
        return completeOrder(orderId, reqHeaders);
    }

    const order = await orderRepository.findByIdWithItems(orderId);
    if (!order) return { error: 'Venta no encontrada.', status: 404 };

    const result = await orderRepository.updateStatus(orderId, estado);
    logger.info('Estado de venta actualizado', { id_vent: orderId, estado });
    return { ok: true, data: result.rows[0] };
}

module.exports = { createOrder, completeOrder, updateStatus };
