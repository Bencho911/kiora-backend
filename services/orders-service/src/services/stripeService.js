'use strict';

const logger = require('../config/logger');

/**
 * Lazy init: evita crash al importar si STRIPE_SECRET_KEY no está definido (ej: tests).
 */
let _stripe = null;
function getStripe() {
    if (!_stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY no está definido en las variables de entorno.');
        }
        _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
    return _stripe;
}

/**
 * Crea una sesión de Checkout de Stripe para una orden.
 *
 * @param {Object} order La orden de base de datos { id_vent, montofinal_vent }
 * @param {Array} items Lista de items comprados para mostrar en Stripe
 * @returns {Promise<string>} La URL generada para pagar
 */
const createCheckoutSession = async (order, items) => {
    try {
        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.map((item) => ({
                price_data: {
                    currency: 'cop',
                    product_data: {
                        name: item.nom_prod || ('Producto #' + item.cod_prod),
                    },
                    unit_amount: Math.round(item.precio_unit * 100), // Stripe usa centavos
                },
                quantity: item.cantidad,
            })),
            mode: 'payment',
            success_url: 'http://localhost:5173/payment-success?order_id=' + order.id_vent,
            cancel_url: 'http://localhost:5173/payment-cancel?order_id=' + order.id_vent,
            client_reference_id: String(order.id_vent),
            metadata: {
                order_id: String(order.id_vent),
            },
        });

        return session.url;
    } catch (error) {
        logger.error('Error creando sesión de Stripe:', { error: error.message });
        throw error;
    }
};

/**
 * Emite un reembolso en Stripe para un payment_intent dado.
 *
 * @param {string} paymentIntentId — El ID del payment_intent (ej: 'pi_3Mxxxxxx')
 * @returns {Promise<Object>} El objeto refund de Stripe
 */
const createRefund = async (paymentIntentId) => {
    try {
        const refund = await getStripe().refunds.create({
            payment_intent: paymentIntentId,
        });
        logger.info('Stripe: Reembolso emitido', {
            refundId: refund.id,
            paymentIntentId,
            amount: refund.amount,
            status: refund.status,
        });
        return refund;
    } catch (error) {
        logger.error('Error emitiendo reembolso Stripe:', {
            paymentIntentId,
            error: error.message,
        });
        throw error;
    }
};

/**
 * Valida que el webhook entrante haya sido realmente enviado por Stripe.
 *
 * @param {Buffer} rawBody El body crudo (raw buffer) del Request
 * @param {string} signature El header stripe-signature
 * @returns {Object} El objeto evento de Stripe validado
 */
const verifyWebhookSignature = (rawBody, signature) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    try {
        return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
        logger.error('Error verificando firma de webhook Stripe:', { error: error.message });
        throw new Error('Firma de Stripe inválida');
    }
};

module.exports = {
    createCheckoutSession,
    createRefund,
    verifyWebhookSignature,
};
