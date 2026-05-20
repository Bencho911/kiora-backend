'use strict';

const stripeService = require('../services/stripeService');
const orderService = require('../services/orderService');
const orderRepository = require('../repositories/orderRepository');
const logger = require('../config/logger');
const { outgoingHeaders, fetchWithRetry, DEFAULT_TIMEOUT_MS } = require('../utils/httpClient');

const generateCheckoutParams = async (req, res) => {
    const { id } = req.params;
    const { success_url, cancel_url } = req.body || {};

    try {
        const orden = await orderRepository.findByIdWithItems(id);
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

        try {
            // ── Completar la orden con toda la lógica transaccional ──
            // Se usa completeOrder() que en una sola transacción atómica:
            //   a) Cambia estado a 'completada' (+ stripe_payment_id)
            //   b) Crea la factura
            //   c) Inserta eventos outbox de movimiento de inventario (salida) por cada ítem
            //   d) Inserta evento outbox para facturación electrónica (Factus/DIAN)
            //   e) Envía broadcast WebSocket al dashboard (fuera de la transacción)
            // stripePaymentId se pasa para guardarlo dentro de la misma transacción,
            // evitando que quede una orden completada sin ID de pago para reembolsos.
            const result = await orderService.completeOrder(orderId, req.headers, paymentIntent);

            if (!result.ok) {
                logger.error('Error completando orden desde webhook Stripe', {
                    orderId, error: result.error, code: result.code,
                });
                return res.status(result.status || 500).json({ error: result.error || 'Error completando la orden.' });
            }
        } catch (err) {
            logger.error('Error CRÍTICO en webhook Stripe — excepción no capturada en completeOrder', {
                orderId, error: err.message, stack: err.stack,
            });
            return res.status(500).json({ error: 'Error interno procesando el webhook.' });
        }
    }

    res.json({ received: true });
};

module.exports = {
    generateCheckoutParams,
    handleStripeWebhook,
};
