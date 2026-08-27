import logger from '../config/logger';
import Stripe from 'stripe';

/**
 * Lazy init: evita crash al importar si STRIPE_SECRET_KEY no está definido (ej: tests).
 */
let _stripe: any | null = null;
function getStripe(): any {
    if (!_stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY no está definido en las variables de entorno.');
        }
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        } as any);
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
const STRIPE_MIN_AMOUNT = 1000; // Stripe requiere mínimo ~1000 por línea

export const createCheckoutSession = async (order: any, items: any[], successUrl: string | null = null, cancelUrl: string | null = null) => {
    try {
        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.map((item) => {
                const rawAmount = Math.round(Number(item.precio_unit));
                return {
                    price_data: {
                        currency: 'cop',
                        product_data: {
                            name: item.nom_prod || ('Producto #' + item.cod_prod),
                        },
                        // Stripe interpreta COP con 2 decimales (ej. 1000 = $10.00 COP).
                        // Se multiplica por 100 para enviar el valor correcto.
                        unit_amount: Math.max(rawAmount, STRIPE_MIN_AMOUNT) * 100,
                    },
                    quantity: item.cantidad,
                };
            }),
            mode: 'payment',
            success_url: successUrl || 'http://localhost:5173/payment-success?order_id=' + order.id_vent,
            cancel_url: cancelUrl || 'http://localhost:5173/payment-cancel?order_id=' + order.id_vent,
            client_reference_id: String(order.id_vent),
            metadata: {
                order_id: String(order.id_vent),
            },
        });

        return session.url;
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
        throw error;
    }
};

/**
 * Emite un reembolso en Stripe para un payment_intent dado.
 *
 * @param {string} paymentIntentId — El ID del payment_intent (ej: 'pi_3Mxxxxxx')
 * @returns {Promise<Object>} El objeto refund de Stripe
 */
export const createRefund = async (paymentIntentId: string) => {
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
    } catch (error: unknown) {
        logger.error('Error emitiendo reembolso Stripe:', {
            paymentIntentId,
            error: (error as Error).message,
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
export const verifyWebhookSignature = (rawBody: Buffer, signature: string) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET no configurado');
    }
    try {
        return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
        throw new Error('Firma de Stripe inválida');
    }
};
