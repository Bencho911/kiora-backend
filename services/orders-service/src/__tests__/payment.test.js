'use strict';

/**
 * Tests del controlador de pagos (Stripe Webhook).
 *
 * Verifica que handleStripeWebhook:
 * - Rechaza firmas inválidas con 400
 * - Inserta evento outbox en lugar de llamar HTTP a inventory
 * - Usa transacción BD atómica (BEGIN/COMMIT o ROLLBACK en error)
 */

process.env.NODE_ENV = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test';

const stripeService = require('../services/stripeService');
const mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
};

jest.mock('../config/db', () => ({
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
}));

const request = require('supertest');
const app = require('../app');

describe('Stripe Webhook (handleStripeWebhook)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockReset();
        mockClient.query.mockResolvedValue({ rows: [] });
    });

    test('400 cuando la firma es inválida', async () => {
        // StripeService lanza error de firma
        jest.spyOn(stripeService, 'verifyWebhookSignature').mockImplementationOnce(() => {
            throw new Error('Invalid signature');
        });

        const res = await request(app)
            .post('/api/orders/checkout/webhook')
            .set('stripe-signature', 'bad_sig')
            .send({ type: 'checkout.session.completed' });

        expect(res.status).toBe(400);
        expect(res.text).toContain('Webhook Error');
    });

    test('200 + outbox event insertado en transacción cuando el pago es exitoso', async () => {
        const fakeEvent = {
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_123',
                    metadata: { order_id: '42' },
                    payment_intent: 'pi_test_456',
                },
            },
        };

        jest.spyOn(stripeService, 'verifyWebhookSignature').mockReturnValue(fakeEvent);

        const res = await request(app)
            .post('/api/orders/checkout/webhook')
            .set('stripe-signature', 'valid_sig')
            .send(fakeEvent);

        expect(res.status).toBe(200);
        expect(res.body.received).toBe(true);

        // Verificar transacción BD
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');

        // Verificar UPDATE de la venta
        const updateCall = mockClient.query.mock.calls.find(
            ([text]) => text.includes('UPDATE Ventas')
        );
        expect(updateCall).toBeDefined();
        expect(updateCall[0]).toContain('UPDATE Ventas SET estado');
        expect(updateCall[1]).toEqual(expect.arrayContaining(['pagado', 'stripe_tarjeta', 'pi_test_456', '42']));

        // Verificar que se insertó evento outbox (NO fetch directo a inventory)
        const outboxCall = mockClient.query.mock.calls.find(
            ([text]) => text.includes('INSERT INTO outbox_events')
        );
        expect(outboxCall).toBeDefined();

        const insertedPayload = JSON.parse(outboxCall[1][1]);
        expect(outboxCall[1][0]).toBe('inventory.reserve.commit');
        expect(insertedPayload).toEqual({ orderId: '42' });

        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

        // Verificar que NO hubo fetch a inventory
        const inventoryFetchCalls = mockClient.query.mock.calls.filter(
            ([, params]) => params && params.some(p => typeof p === 'string' && p.includes('/api/inventory/saga/reserve/commit'))
        );
        expect(inventoryFetchCalls).toHaveLength(0);
    });

    test('ROLLBACK si ocurre error en la transacción', async () => {
        const fakeEvent = {
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_456',
                    metadata: { order_id: '99' },
                    payment_intent: 'pi_test_789',
                },
            },
        };

        jest.spyOn(stripeService, 'verifyWebhookSignature').mockReturnValue(fakeEvent);

        // Simular error en el UPDATE
        mockClient.query.mockRejectedValueOnce(new Error('DB connection lost'));

        const res = await request(app)
            .post('/api/orders/checkout/webhook')
            .set('stripe-signature', 'valid_sig')
            .send(fakeEvent);

        expect(res.status).toBe(500);
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
    });
});
