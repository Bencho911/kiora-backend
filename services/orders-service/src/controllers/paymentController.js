'use strict';

const stripeService = require('../services/stripeService');
const { findByIdWithItems } = require('../repositories/orderRepository');
const { insertOutboxEvent } = require('../repositories/orderRepository');
const db = require('../config/db');
const logger = require('../config/logger');
const { outgoingHeaders, fetchWithRetry, DEFAULT_TIMEOUT_MS } = require('../utils/httpClient');

const generateCheckoutParams = async (req, res) => {
    const { id } = req.params;
    const { success_url, cancel_url } = req.body || {};

    try {
        const orden = await findByIdWithItems(id);
        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada.' });
        }

        if (orden.estado === 'pagado' || orden.estado === 'completada') {
            return res.status(400).json({ error: 'La orden ya está pagada o completada.' });
        }

        // ── LLAMADA SÍNCRONA: Validar stock antes de cobrar ──
        // Se mantiene síncrona intencionalmente: es mejor decirle al cliente
        // "no hay stock" ANTES de cobrarle, que cobrar y reembolsar después.
        const headers = outgoingHeaders(req.headers);
        const reserveRes = await fetchWithRetry(
            process.env.INVENTORY_SERVICE_URL + '/api/inventory/saga/reserve',
            {
                method: 'POST',
                headers,
                body: JSON.stringify({ orderId: orden.id_vent, items: orden.items }),
            },
            {
                maxRetries: 1,
                timeoutMs: DEFAULT_TIMEOUT_MS,
                onNonRetryable: (status) => status >= 400 && status < 500,
            }
        );

        if (!reserveRes.ok) {
            const errData = await reserveRes.json().catch(() => ({}));
            return res.status(409).json({ error: errData.error || 'Agotado o fallo reservando inventario temporalmente' });
        }

        const url = await stripeService.createCheckoutSession(orden, orden.items, success_url, cancel_url);

        res.status(200).json({
            status: 'ok',
            checkoutUrl: url,
        });

    } catch (error) {
        logger.error('Error generando link de pago Checkout', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Error interno generando link de pago.' });
    }
};

const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripeService.verifyWebhookSignature(req.body, sig);
    } catch (err) {
        logger.error('Webhook Error de Firma:', { detail: err.message });
        return res.status(400).send('Webhook Error: ' + err.message);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata.order_id || session.client_reference_id;
        const paymentIntent = session.payment_intent;

        logger.info('Stripe Webhook: Orden #' + orderId + ' Pagada con Éxito', { paymentIntent });

        // ── Transacción atómica: estado + stripe_payment_id + outbox event ──
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // 1. Actualizar estado y guardar stripe_payment_id para futuros reembolsos
            await client.query(
                'UPDATE Ventas SET estado = $1, metodopago_usu = $2, stripe_payment_id = $3 WHERE id_vent = $4',
                ['pagado', 'stripe_tarjeta', paymentIntent, orderId]
            );

            // ── LLAMADA SAGA: Confirmar Reserva Permanentemente ──
            await fetch(process.env.INVENTORY_SERVICE_URL + '/api/inventory/saga/reserve/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            });
            logger.info('Commit formal enviado a Inventory Service', { orderId });

        } catch (dbError) {
            await client.query('ROLLBACK');
            logger.error('Error en transacción Webhook Stripe:', { dbError: dbError.message, orderId });
        } finally {
            client.release();
        }
    }

    res.json({ received: true });
};

module.exports = {
    generateCheckoutParams,
    handleStripeWebhook,
};
