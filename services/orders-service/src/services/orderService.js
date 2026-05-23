'use strict';

const orderRepository = require('../repositories/orderRepository');
const invoiceRepository = require('../repositories/invoiceRepository');
const db = require('../config/db');
const logger = require('../config/logger');
const stripeService = require('./stripeService');
const { outgoingHeaders, fetchWithRetry, NOTIFY_TIMEOUT_MS } = require('../utils/httpClient');

/**
 * orderService
 * Capa de servicio que encapsula la lógica de negocio de órdenes.
 *
 * Fase 5: Las operaciones de inventario ahora se delegan al Outbox Poller.
 * En lugar de hacer llamadas HTTP síncronas a inventory-service, se insertan
 * eventos en la tabla outbox_events dentro de la misma transacción que actualiza
 * el estado de la orden. Esto garantiza consistencia atómica local y
 * consistencia eventual con inventory-service.
 */

/* ── Crear orden ─────────────────────────────────────────────────────────── */

/**
 * Crea una venta con sus ítems.
 * @param {{ metodopago_usu?: string, items: Array }} data
 */
async function createOrder(data) {
    const KIOSKO_USER_ID = Number(process.env.KIOSKO_USER_ID || 1);
    const order = await orderRepository.createWithItems({ ...data, id_usu: KIOSKO_USER_ID, descuento_global: data.descuento_global });
    logger.info('Venta creada', { id_vent: order.id_vent });
    return order;
}

/* ── Completar venta (Outbox transaccional) ──────────────────────────────── */

/**
 * Completa una venta usando el patrón Outbox transaccional.
 *
 * Flujo:
 * 1. Validar estado de la orden (idempotencia, transición válida)
 * 2. BEGIN transacción
 *    a. UPDATE Ventas → 'completada' (+ stripe_payment_id si aplica)
 *    b. INSERT Factura
 *    c. INSERT outbox_events (inventory.movement) × N ítems
 * 3. COMMIT
 * 4. Broadcast al dashboard (fire & forget, fuera de la transacción)
 *
 * El Outbox Poller despachará los eventos a inventory-service en background.
 * Si inventory rechaza un movimiento (409), el poller disparará la
 * compensación automática (cancelación + reembolso Stripe si aplica).
 *
 * @param {number} orderId
 * @param {object} reqHeaders — Headers del request original (para correlation-id)
 * @param {string} [stripePaymentId] — PaymentIntent de Stripe (opcional, desde webhook)
 */
async function completeOrder(orderId, reqHeaders, stripePaymentId) {
    const order = await orderRepository.findByIdWithItems(orderId);
    if (!order) return { error: 'Venta no encontrada.', status: 404 };

    // ── Idempotencia: si ya fue completada, no reprocessar ──
    if (order.estado === 'completada') {
        logger.warn('Outbox: orden ya completada, ignorando (idempotente)', { orderId });
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

    // ── Transacción atómica: estado + factura + outbox events ──
    const client = await db.connect();
    let updatedOrder;

    try {
        await client.query('BEGIN');

        // 1. Marcar venta como completada (incluye stripe_payment_id si viene del webhook)
        const result = await orderRepository.updateStatus(orderId, 'completada', client);
        updatedOrder = result.rows[0];

        // 1b. Guardar stripe_payment_id dentro de la misma transacción para evitar
        //     datos huérfanos (orden completada sin ID de pago → imposible reembolsar)
        if (stripePaymentId) {
            await client.query(
                'UPDATE Ventas SET stripe_payment_id = $1, metodopago_usu = $2 WHERE id_vent = $3',
                [stripePaymentId, 'stripe_tarjeta', orderId]
            );
        }

        // 2. Generar factura
        const totalQty = order.items.reduce((sum, i) => sum + i.cantidad, 0);
        const userId = Number(process.env.KIOSKO_USER_ID || 1);
        await invoiceRepository.create({
            fk_id_vent: orderId,
            id_usu: userId,
            cantidad_vent: totalQty,
            precio_prod: order.items[0]?.precio_unit || 0,
            montototal_vent: updatedOrder.montofinal_vent,
        }, client);

        // 3. Insertar eventos outbox para cada ítem (descuento de inventario)
        for (const item of order.items) {
            await orderRepository.insertOutboxEvent(
                'inventory.movement',
                {
                    tipo_mov: 'salida',
                    cantidad: item.cantidad,
                    cod_prod: item.cod_prod,
                    fk_id_vent: Number(orderId),
                    desc_mov: `Venta #${orderId}`,
                },
                client
            );
        }

        // 4. Insertar evento outbox para facturación electrónica (Factus/DIAN)
        await orderRepository.insertOutboxEvent(
            'factus.invoice',
            {
                orderId: Number(orderId),
                montofinal_vent: updatedOrder.montofinal_vent,
                metodopago_usu: updatedOrder.metodopago_usu,
            },
            client
        );

        await client.query('COMMIT');
        logger.info('Transacción Outbox completada', {
            id_vent: orderId,
            estado: 'completada',
            outboxEvents: order.items.length,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Error en transacción Outbox de completeOrder', {
            orderId, error: err.message,
        });
        return { ok: false, error: `Error en transacción: ${err.message}`, code: 'TRANSACTION_ERROR', status: 500 };
    } finally {
        client.release();
    }

    // ── Broadcast al dashboard (fire & forget, fuera de la transacción) ──
    try {
        const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';
        await fetchWithRetry(
            `${GATEWAY_URL}/api/internal/broadcast`,
            {
                method: 'POST',
                headers: outgoingHeaders(reqHeaders),
                body: JSON.stringify({
                    event: 'new_sale',
                    payload: updatedOrder,
                }),
            },
            { maxRetries: 1, timeoutMs: NOTIFY_TIMEOUT_MS }
        );
    } catch (wsErr) {
        logger.warn('No se pudo notificar nueva venta al Dashboard (WebSocket)', { error: wsErr.message });
    }

    logger.info('Estado de venta consolidado', { id_vent: orderId, estado: 'completada' });
    return { ok: true, data: updatedOrder };
}

/* ── Actualizar estado genérico ──────────────────────────────────────────── */

/**
 * Actualiza el estado de una venta. Si es 'completada', ejecuta el flujo Outbox.
 * Si es 'reembolsada', genera eventos outbox de entrada de inventario.
 */
async function updateStatus(orderId, estado, reqHeaders) {
    if (estado === 'completada') {
        return completeOrder(orderId, reqHeaders);
    }

    const order = await orderRepository.findByIdWithItems(orderId);
    if (!order) return { error: 'Venta no encontrada.', status: 404 };

    // Regla: Si la venta ya está reembolsada, es un estado FINAL.
    if (order.estado === 'reembolsada') {
        return {
            error: 'Esta venta ya ha sido reembolsada; no se puede volver a cambiar su estado.',
            status: 400
        };
    }

    // Regla de Negocio: Solo permitir reembolso si la venta estaba completada
    if (estado === 'reembolsada' && order.estado !== 'completada') {
        return {
            error: 'Solo se pueden reembolsar ventas que ya estén marcadas como "completada".',
            status: 400
        };
    }

    // ── Reembolso: Stripe + Inventario (Outbox) + Nota Crédito Factus ──
    if (estado === 'reembolsada') {
        logger.info('Procesando reembolso completo', { orderId });

        // 1. Reembolso en Stripe (si la venta se pagó con tarjeta)
        if (order.stripe_payment_id) {
            try {
                await stripeService.createRefund(order.stripe_payment_id);
                logger.info('Stripe: reembolso emitido', { orderId, paymentId: order.stripe_payment_id });
            } catch (stripeErr) {
                logger.error('CRÍTICO: Falló reembolso Stripe', {
                    orderId, stripe_payment_id: order.stripe_payment_id, error: stripeErr.message,
                });
                // Continuamos con el reembolso interno; el reembolso Stripe se hará manualmente
            }
        }

        // 2. Transacción atómica: estado + inventario + nota crédito Factus
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            const updated = await orderRepository.updateStatus(orderId, 'reembolsada', client);

            // 2a. Eventos outbox para devolver inventario
            for (const item of order.items) {
                await orderRepository.insertOutboxEvent(
                    'inventory.movement',
                    {
                        tipo_mov: 'entrada',
                        cantidad: item.cantidad,
                        cod_prod: item.cod_prod,
                        fk_id_vent: Number(orderId),
                        desc_mov: `REEMBOLSO: Venta #${orderId}`
                    },
                    client
                );
            }

            // 2b. Evento outbox para emitir nota crédito en Factus (DIAN)
            const invoiceResult = await invoiceRepository.findByVentaWithFactus(orderId);
            const invoice = invoiceResult.rows[0];
            if (invoice && invoice.factus_invoice_number) {
                await orderRepository.insertOutboxEvent(
                    'factus.credit_note',
                    {
                        orderId: Number(orderId),
                        billNumber: invoice.factus_invoice_number,
                        invoiceId: invoice.id,
                        montofinal_vent: order.montofinal_vent,
                        metodopago_usu: order.metodopago_usu,
                    },
                    client
                );
            } else {
                logger.warn('Reembolso: no se encontró factura Factus para emitir NC', { orderId });
            }

            await client.query('COMMIT');
            logger.info('Reembolso encolado vía Outbox (inventario + NC Factus)', { orderId, items: order.items.length });
            return { ok: true, data: updated.rows[0] };
        } catch (err) {
            await client.query('ROLLBACK');
            logger.error('Error en transacción de reembolso Outbox', { orderId, error: err.message });
            throw err;
        } finally {
            client.release();
        }
    }

    // ── Otros estados (cancelada, etc.) — sin outbox ──
    const result = await orderRepository.updateStatus(orderId, estado);
    logger.info('Estado de venta actualizado', { id_vent: orderId, estado });
    return { ok: true, data: result.rows[0] };
}

module.exports = { createOrder, completeOrder, updateStatus };
