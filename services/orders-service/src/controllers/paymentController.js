'use strict';

const stripeService = require('../services/stripeService');
const { getOrderById } = require('../repositories/orderRepository');
const db = require('../config/db');
const logger = require('../config/logger');

const generateCheckoutParams = async (req, res) => {
    const { id } = req.params;

    try {
        const orderResult = await getOrderById(id);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada.' });
        }

        const orden = orderResult.rows[0];
        
        if (orden.estado === 'pagada' || orden.estado === 'completada') {
            return res.status(400).json({ error: 'La orden ya está pagada o completada.' });
        }

        // ── LLAMADA SAGA: Solicitar Reserva a Inventory Service ──
        const reserveRes = await fetch(process.env.INVENTORY_SERVICE_URL + '/api/inventory/saga/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orden.id_vent, items: orden.items })
        });

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
            await fetch(process.env.INVENTORY_SERVICE_URL + '/api/inventory/saga/reserve/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            });
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
