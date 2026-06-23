'use strict';

const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../config/logger');
const env = require('../config/env');
const asyncContext = require('../utils/asyncContext');
const { fetchWithRetry, DEFAULT_TIMEOUT_MS, NOTIFY_TIMEOUT_MS, outgoingHeaders } = require('../utils/httpClient');
const stripeService = require('./stripeService');
const factusService = require('./factusService');
const orderRepository = require('../repositories/orderRepository');
const invoiceRepository = require('../repositories/invoiceRepository');

/**
 * Outbox Poller con retry inteligente, Dead-Letter Queue (DLQ)
 * y compensación automática para errores de negocio.
 *
 * Estrategia de reintentos:
 * - Backoff exponencial con jitter: base * 2^retry_count * (0.5 + random())
 * - Max retries configurable por evento (default: 5)
 * - Eventos que agotan reintentos → status = 'dead_letter'
 * - Errores de negocio (4xx) → compensación automática inmediata
 *
 * Tipos de evento soportados:
 * - inventory.movement: Descuento/entrada de stock
 * - inventory.reserve.commit: Confirmar reserva temporal
 * - factus.invoice: Emitir factura electrónica ante la DIAN
 * - factus.credit_note: Emitir nota crédito ante la DIAN (reembolso)
 *
 * Métricas de observabilidad expuestas vía getMetrics().
 */

const POLL_INTERVAL_MS = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS, 10) || 5000;
const BATCH_SIZE = parseInt(process.env.OUTBOX_BATCH_SIZE, 10) || 10;
const BACKOFF_BASE_MS = 5000; // 5 segundos base

/** Métricas internas */
const metrics = {
    processed: 0,
    failed: 0,
    deadLettered: 0,
    compensated: 0,
    pollCycles: 0,
};

/* ── Procesamiento de eventos ────────────────────────────────────────────── */

/**
 * Procesa un único evento del outbox.
 * @returns {{ ok: boolean, businessError?: boolean }} Resultado del procesamiento
 */
async function processEvent(event) {
    const { id, event_type, payload } = event;

    switch (event_type) {
    case 'inventory.movement': {
        const url = `${env.inventoryServiceUrl}/api/inventory/movements`;
        try {
            await fetchWithRetry(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }, { maxRetries: 1, timeoutMs: DEFAULT_TIMEOUT_MS });

            logger.info('Outbox: evento procesado', { id, event_type, cod_prod: payload.cod_prod });
            return { ok: true };
        } catch (err) {
            // ── Error de negocio (4xx): no reintentar, compensar ──
            if (err.status && err.status >= 400 && err.status < 500) {
                logger.warn('Outbox: error de negocio en inventory', {
                    id, event_type, status: err.status,
                    cod_prod: payload.cod_prod, error: err.message,
                });
                return { ok: false, businessError: true };
            }

            // ── Error de red / 5xx: reintentar ──
            logger.warn('Outbox: fallo al procesar evento', {
                id, event_type, error: err.message, retry_count: event.retry_count,
            });
            return { ok: false, businessError: false };
        }
    }

    case 'inventory.reserve.commit': {
        const url = `${env.inventoryServiceUrl}/api/inventory/saga/reserve/commit`;
        try {
            await fetchWithRetry(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }, { maxRetries: 1, timeoutMs: DEFAULT_TIMEOUT_MS });

            logger.info('Outbox: reserva confirmada', { id, event_type, orderId: payload.orderId });
            return { ok: true };
        } catch (err) {
            logger.warn('Outbox: fallo al confirmar reserva', {
                id, event_type, error: err.message, retry_count: event.retry_count,
            });
            return { ok: false, businessError: false };
        }
    }

    /* ── Facturación Electrónica (Factus/DIAN) ───────────────────────────── */

    case 'factus.invoice': {
        try {
            const orderId = payload.orderId;
            const order = await orderRepository.findByIdWithItems(orderId);
            if (!order) {
                logger.error('Outbox factus.invoice: orden no encontrada', { id, orderId });
                return { ok: true }; // No reintentar, la orden no existe
            }

            // Emitir factura electrónica
            const result = await factusService.createInvoice(order, order.items);

            // Guardar datos de la factura en la BD
            const invoiceResult = await invoiceRepository.findByVenta(orderId);
            if (invoiceResult.rows.length > 0) {
                await invoiceRepository.updateFactusFields(invoiceResult.rows[0].id, {
                    factus_invoice_number: result.number,
                    factus_cufe: result.cufe,
                    factus_public_url: result.public_url,
                    factus_qr_link: result.qr_link,
                    factus_status: 'validated',
                });
            }

            logger.info('Outbox: factura electrónica emitida', {
                id, orderId, factusNumber: result.number,
            });
            return { ok: true };
        } catch (err) {
            // Si es error de validación (422) de Factus, marcar como fallo de negocio
            if (err.status && err.status === 422) {
                logger.error('Outbox factus.invoice: error de validación Factus', {
                    id, orderId: payload.orderId, errors: err.factusErrors,
                });
                // Marcar la factura como fallida pero no compensar la orden
                const invoiceResult = await invoiceRepository.findByVenta(payload.orderId);
                if (invoiceResult.rows.length > 0) {
                    await invoiceRepository.updateFactusFields(invoiceResult.rows[0].id, {
                        factus_status: 'failed',
                    });
                }
                return { ok: true }; // No reintentar errores de validación
            }
            logger.warn('Outbox factus.invoice: fallo temporal', {
                id, error: err.message, retry_count: event.retry_count,
            });
            return { ok: false, businessError: false };
        }
    }

    case 'factus.credit_note': {
        try {
            const { orderId, billNumber, invoiceId } = payload;
            const order = await orderRepository.findByIdWithItems(orderId);
            if (!order) {
                logger.error('Outbox factus.credit_note: orden no encontrada', { id, orderId });
                return { ok: true };
            }

            // Emitir nota crédito
            await factusService.createCreditNote(billNumber, order, order.items);

            // Actualizar estado de la factura
            if (invoiceId) {
                await invoiceRepository.updateFactusFields(invoiceId, {
                    factus_status: 'credit_noted',
                });
            }

            logger.info('Outbox: nota crédito emitida ante DIAN', {
                id, orderId, billNumber,
            });
            return { ok: true };
        } catch (err) {
            if (err.status && err.status === 422) {
                logger.error('Outbox factus.credit_note: error de validación Factus', {
                    id, errors: err.factusErrors,
                });
                return { ok: true }; // No reintentar
            }
            logger.warn('Outbox factus.credit_note: fallo temporal', {
                id, error: err.message, retry_count: event.retry_count,
            });
            return { ok: false, businessError: false };
        }
    }

    default:
        logger.warn('Outbox: tipo de evento desconocido', { id, event_type });
        return { ok: true }; // No bloquear el poller
    }
}

/* ── Compensación automática ─────────────────────────────────────────────── */

/**
 * Compensa una orden cuyo descuento de inventario fue rechazado (error de negocio).
 *
 * Flujo:
 * 1. Buscar la orden en BD
 * 2. Si tiene stripe_payment_id → emitir reembolso vía Stripe
 * 3. Actualizar estado: 'reembolsada' (si pagó con Stripe) o 'cancelada' (si no)
 * 4. Broadcast al dashboard
 *
 * @param {number} orderId — ID de la venta a compensar
 * @param {string} reason — Motivo de la compensación
 */
async function compensateOrder(orderId, reason) {
    logger.warn('⚠️ COMPENSACIÓN AUTOMÁTICA: Iniciando', { orderId, reason });

    try {
        // 1. Obtener orden con sus datos de pago
        const orderResult = await db.query(
            'SELECT id_vent, estado, stripe_payment_id FROM Ventas WHERE id_vent = $1',
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            logger.error('Compensación: orden no encontrada', { orderId });
            return;
        }

        const order = orderResult.rows[0];

        // Evitar doble compensación
        if (order.estado === 'cancelada' || order.estado === 'reembolsada') {
            logger.warn('Compensación: orden ya compensada, ignorando', {
                orderId, estado: order.estado,
            });
            return;
        }

        let newStatus = 'cancelada';

        // 2. Si tiene pago Stripe → reembolsar
        if (order.stripe_payment_id) {
            try {
                await stripeService.createRefund(order.stripe_payment_id);
                newStatus = 'reembolsada';
                logger.info('Compensación: reembolso Stripe emitido', { orderId });
            } catch (refundErr) {
                logger.error('CRÍTICO: Falló el reembolso Stripe en compensación', {
                    orderId,
                    stripe_payment_id: order.stripe_payment_id,
                    error: refundErr.message,
                });
                // Aún así cancelamos la orden; el reembolso se deberá hacer manualmente
                newStatus = 'cancelada';
            }
        }

        // 3. Actualizar estado de la orden
        await orderRepository.updateStatus(orderId, newStatus);
        metrics.compensated++;

        logger.info('✅ COMPENSACIÓN AUTOMÁTICA: Completada', {
            orderId,
            newStatus,
            hadStripePayment: !!order.stripe_payment_id,
        });

        // 4. Notificar al dashboard
        try {
            const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';
            await fetchWithRetry(
                `${GATEWAY_URL}/api/internal/broadcast`,
                {
                    method: 'POST',
                    headers: outgoingHeaders({}),
                    body: JSON.stringify({
                        event: 'order_compensated',
                        payload: {
                            orderId,
                            newStatus,
                            reason,
                        },
                    }),
                },
                { maxRetries: 1, timeoutMs: NOTIFY_TIMEOUT_MS }
            );
        } catch {
            // Fire & forget
        }

    } catch (err) {
        logger.error('CRÍTICO: Error en compensación automática', {
            orderId, error: err.message,
        });
    }
}

/* ── Ciclo de polling ────────────────────────────────────────────────────── */

/**
 * Ejecuta un ciclo de polling con retry inteligente.
 */
async function pollOnce() {
    // Envolver cada ciclo de polling en AsyncLocalStorage con un UUID único
    // para que los logs del poller sean trazables
    const store = new Map([['correlationId', `poller-${crypto.randomUUID().slice(0, 8)}`]]);
    return asyncContext.run(store, async () => {
    try {
        metrics.pollCycles++;

        // Solo tomar eventos cuyo next_retry_at ya pasó
        const result = await db.query(
            `SELECT id, event_type, payload, retry_count, max_retries, created_at
             FROM outbox_events
             WHERE status = 'pending' AND next_retry_at <= NOW()
             ORDER BY id ASC
             LIMIT $1`,
            [BATCH_SIZE]
        );

        if (result.rows.length === 0) return;

        logger.debug(`Outbox: procesando ${result.rows.length} eventos pendientes`);

        for (const event of result.rows) {
            const { ok, businessError } = await processEvent(event);

            if (ok) {
                // Éxito → marcar como procesado
                metrics.processed++;
                await db.query(
                    `UPDATE outbox_events
                     SET status = 'processed', processed_at = NOW()
                     WHERE id = $1`,
                    [event.id]
                );
            } else if (businessError) {
                // Error de negocio → no reintentar, compensar automáticamente
                await db.query(
                    `UPDATE outbox_events
                     SET status = 'failed_business_error', last_error = $2, processed_at = NOW()
                     WHERE id = $1`,
                    [event.id, 'Business error: inventory rejected the operation']
                );

                // Extraer orderId del payload para compensar
                const orderId = event.payload.fk_id_vent || event.payload.orderId;
                if (orderId) {
                    await compensateOrder(orderId, `Inventory rejected event #${event.id}: ${event.event_type}`);
                } else {
                    logger.error('Outbox: no se pudo extraer orderId para compensar', {
                        eventId: event.id, payload: event.payload,
                    });
                }
            } else {
                // Error de red/servidor → reintentar con backoff + jitter
                const newRetryCount = event.retry_count + 1;

                if (newRetryCount >= event.max_retries) {
                    // Agotó reintentos → Dead Letter Queue
                    metrics.deadLettered++;
                    await db.query(
                        `UPDATE outbox_events
                         SET status = 'dead_letter', retry_count = $2,
                             last_error = 'Max retries exceeded'
                         WHERE id = $1`,
                        [event.id, newRetryCount]
                    );
                    logger.error('Outbox: evento enviado a DLQ (max retries)', {
                        id: event.id,
                        event_type: event.event_type,
                        retry_count: newRetryCount,
                    });
                } else {
                    // Backoff exponencial con jitter
                    metrics.failed++;
                    const backoffMs = BACKOFF_BASE_MS * Math.pow(2, newRetryCount - 1) * (0.5 + Math.random());
                    await db.query(
                        `UPDATE outbox_events
                         SET retry_count = $2,
                             next_retry_at = NOW() + ($3 || ' milliseconds')::INTERVAL,
                             last_error = $4
                         WHERE id = $1`,
                        [event.id, newRetryCount, Math.round(backoffMs), 'Retry scheduled']
                    );
                    logger.info('Outbox: evento reprogramado con backoff', {
                        id: event.id, retry_count: newRetryCount, nextRetryInMs: Math.round(backoffMs),
                    });
                }
            }
        }
    } catch (err) {
        logger.error('Outbox poller: error en ciclo de polling', { error: err.message });
    }
    }); // asyncContext.run
}

/**
 * Inicia el loop de polling.
 * @returns {{ stop: Function }}
 */
function startPoller() {
    logger.info('Outbox poller iniciado', { intervalMs: POLL_INTERVAL_MS, batchSize: BATCH_SIZE });
    const intervalId = setInterval(pollOnce, POLL_INTERVAL_MS);
    return {
        stop: () => {
            clearInterval(intervalId);
            logger.info('Outbox poller detenido');
        },
    };
}

/** Retorna snapshot de métricas para observabilidad. */
function getMetrics() {
    return { ...metrics };
}

module.exports = { startPoller, pollOnce, processEvent, compensateOrder, getMetrics };
