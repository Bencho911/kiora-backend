'use strict';

const stripeService = require('../services/stripeService');
const { findByIdWithItems } = require('../repositories/orderRepository');
const db = require('../config/db');
const logger = require('../config/logger');
const { outgoingHeaders, fetchWithRetry, DEFAULT_TIMEOUT_MS } = require('../utils/httpClient');

const generateCheckoutParams = async (req, res) => {
    const { id } = req.params;

    try {
        const orden = await findByIdWithItems(id);
        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada.' });
        }
        
        if (orden.estado === 'pagado' || orden.estado === 'completada') {
            return res.status(400).json({ error: 'La orden ya está pagada o completada.' });
        }

        // ── LLAMADA SAGA: Solicitar Reserva a Inventory Service ──
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

        const url = await stripeService.createCheckoutSession(orden, orden.items);

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

        logger.info('Stripe Webhook: Orden #' + orderId + ' Pagada con Éxito');

        try {
            await db.query(
                'UPDATE Ventas SET estado = $1, metodopago_usu = $2 WHERE id_vent = $3',
                ['pagado', 'stripe_tarjeta', orderId]
            );

            // ── LLAMADA SAGA: Confirmar Reserva Permanentemente ──
            const headers = outgoingHeaders(req.headers);
            await fetchWithRetry(
                process.env.INVENTORY_SERVICE_URL + '/api/inventory/saga/reserve/commit',
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ orderId }),
                },
                { maxRetries: 3, timeoutMs: DEFAULT_TIMEOUT_MS }
            );
            logger.info('Commit formal enviado a Inventory Service', { orderId });
            
        } catch (dbError) {
            logger.error('Error actualizando la orden post-webhook Stripe:', { dbError: dbError.message });
        }
    }

    res.json({ received: true });
};

module.exports = {
    generateCheckoutParams,
    handleStripeWebhook,
};
