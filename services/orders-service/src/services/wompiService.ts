import crypto from 'crypto';
import logger from '../config/logger';

const WOMPI_CHECKOUT_BASE = 'https://checkout.wompi.co/p/';

/**
 * Genera la firma de integridad SHA-256 requerida por Wompi.
 * Fórmula: SHA256(reference + amountInCents + currency + integritySecret)
 */
const generateIntegritySignature = (reference: string, amountInCents: number, currency = 'COP') => {
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    if (!integritySecret) throw new Error('WOMPI_INTEGRITY_SECRET no está configurado.');
    const raw = `${reference}${amountInCents}${currency}${integritySecret}`;
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
};

/**
 * Crea la URL del checkout hosteado de Wompi para una orden.
 * @param {Object} order - { id_vent, montofinal_vent } (montofinal_vent en pesos COP)
 * @param {string|null} redirectUrl - URL de redirección post-pago (opcional)
 * @returns {{ checkoutUrl: string, reference: string }}
 */
export const createCheckoutUrl = (order: any, redirectUrl: string | null = null) => {
    const publicKey = process.env.WOMPI_PUBLIC_KEY;
    if (!publicKey) throw new Error('WOMPI_PUBLIC_KEY no está configurado.');

    const reference = `KIORA-${order.id_vent}`;
    // Wompi requiere el monto en centavos (COP: 1 peso = 100 centavos)
    const amountInCents = Math.round(Number(order.montofinal_vent)) * 100;
    const currency = 'COP';

    const signature = generateIntegritySignature(reference, amountInCents, currency);

    const params = new URLSearchParams({
        'public-key': publicKey,
        currency,
        'amount-in-cents': String(amountInCents),
        reference,
        'signature:integrity': signature,
    });

    if (redirectUrl) params.append('redirect-url', redirectUrl);

    const checkoutUrl = `${WOMPI_CHECKOUT_BASE}?${params.toString()}`;
    logger.info('Wompi: URL de checkout generada', { reference, amountInCents, orderId: order.id_vent });
    return { checkoutUrl, reference };
};

/**
 * Verifica la firma de un evento webhook enviado por Wompi.
 * Lanza error si la firma no es válida.
 * @param {Object} body - El body parseado del request del webhook
 */
export const verifyWebhookSignature = (body: any) => {
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
    if (!eventsSecret) throw new Error('WOMPI_EVENTS_SECRET no está configurado.');

    const { signature } = body;
    if (!signature?.checksum || !Array.isArray(signature?.properties)) {
        throw new Error('Webhook de Wompi sin firma válida.');
    }

    // Concatenar los valores de las propiedades especificadas + timestamp + events_secret
    const concatenated = signature.properties
        .map((prop: string) => {
            // Navegar la ruta: "transaction.id" → body.data.transaction.id
            const keys = prop.split('.');
            let value = body.data;
            for (const key of keys) value = value?.[key];
            return String(value ?? '');
        })
        .join('') + (body.timestamp || '') + eventsSecret;

    const expectedHash = crypto.createHash('sha256').update(concatenated, 'utf8').digest('hex');

    if (expectedHash !== signature.checksum) {
        logger.warn('Wompi: firma de webhook inválida', { expected: expectedHash, received: signature.checksum });
        throw new Error('Firma de Wompi inválida.');
    }
};

/**
 * Extrae el orderId de una referencia de Wompi (formato: "KIORA-{orderId}").
 * @param {string} reference
 * @returns {number|null}
 */
export const extractOrderIdFromReference = (reference: string) => {
    const match = String(reference || '').match(/^KIORA-(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
};
