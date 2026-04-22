'use strict';

const db = require('../config/db');
const logger = require('../config/logger');
const env = require('../config/env');
const { fetchWithRetry } = require('../utils/httpClient');

/**
 * Outbox Poller con retry inteligente y Dead-Letter Queue (DLQ).
 *
 * Estrategia de reintentos:
 * - Backoff exponencial: 5s, 10s, 20s, 40s, 80s (base * 2^retry_count)
 * - Max retries configurable por evento (default: 5)
 * - Eventos que agotan reintentos → status = 'dead_letter'
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
    pollCycles: 0,
};

/**
 * Procesa un único evento del outbox.
 * @returns {boolean} true si fue exitoso
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
            }, { maxRetries: 1 }); // Solo 1 intento por ciclo de poller

            logger.info('Outbox: evento procesado', { id, event_type, cod_prod: payload.cod_prod });
            return true;
        } catch (err) {
            logger.warn('Outbox: fallo al procesar evento', {
                id, event_type, error: err.message, retry_count: event.retry_count,
            });
            return false;
        }
    }
    default:
        logger.warn('Outbox: tipo de evento desconocido', { id, event_type });
        return true; // No bloquear el poller
    }
}

/**
 * Ejecuta un ciclo de polling con retry inteligente.
 */
async function pollOnce() {
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
            const ok = await processEvent(event);

            if (ok) {
                // Éxito → marcar como procesado
                metrics.processed++;
                await db.query(
                    `UPDATE outbox_events
                     SET status = 'processed', processed_at = NOW()
                     WHERE id = $1`,
                    [event.id]
                );
            } else {
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
                    // Backoff exponencial: base * 2^retry_count
                    metrics.failed++;
                    const backoffMs = BACKOFF_BASE_MS * Math.pow(2, newRetryCount - 1);
                    await db.query(
                        `UPDATE outbox_events
                         SET retry_count = $2,
                             next_retry_at = NOW() + ($3 || ' milliseconds')::INTERVAL,
                             last_error = $4
                         WHERE id = $1`,
                        [event.id, newRetryCount, backoffMs, 'Retry scheduled']
                    );
                    logger.info('Outbox: evento reprogramado con backoff', {
                        id: event.id, retry_count: newRetryCount, nextRetryInMs: backoffMs,
                    });
                }
            }
        }
    } catch (err) {
        logger.error('Outbox poller: error en ciclo de polling', { error: err.message });
    }
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

module.exports = { startPoller, pollOnce, processEvent, getMetrics };
