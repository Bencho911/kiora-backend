'use strict';

/**
 * Tests del controlador de pagos (Stripe Webhook).
 *
 * Verifica que handleStripeWebhook:
 * - Rechaza firmas inválidas con 400
 * - Completa la orden automáticamente (status → completada + outbox events)
 * - Guarda stripe_payment_id para reembolsos futuros
 */

process.env.NODE_ENV = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test';

const stripeService = require('../services/stripeService');
const orderRepository = require('../repositories/orderRepository');
const invoiceRepository = require('../repositories/invoiceRepository');

// Mock de repositorios para completeOrder
jest.mock('../repositories/orderRepository');
jest.mock('../repositories/invoiceRepository');

jest.mock('../config/db', () => ({
    query: jest.fn(),
    connect: jest.fn(), // Se asigna en beforeEach
}));

const db = require('../config/db');
let mockClient;

const request = require('supertest');
const app = require('../app');

describe('Stripe Webhook (handleStripeWebhook)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
        db.connect.mockResolvedValue(mockClient);

        // Mock de findByIdWithItems: orden pendiente con 2 items
        orderRepository.findByIdWithItems.mockResolvedValue({
            id_vent: 42,
            estado: 'pendiente',
            montofinal_vent: 500,
            items: [
                { cod_prod: 'PROD-001', cantidad: 2, precio_unit: 100 },
                { cod_prod: 'PROD-002', cantidad: 1, precio_unit: 300 },
            ],
        });

        orderRepository.updateStatus.mockResolvedValue({
            rows: [{ id_vent: 42, estado: 'completada', montofinal_vent: 500 }],
        });

        orderRepository.insertOutboxEvent.mockResolvedValue({ rows: [{ id: 1 }] });
        invoiceRepository.create.mockResolvedValue({ rows: [{ id_fact: 1 }] });
    });

    test('400 cuando la firma es inválida', async () => {
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

    test('200 – completa la orden y guarda payment info', async () => {
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
        orderRepository.updatePaymentInfo = jest.fn().mockResolvedValue({ rows: [] });

        const res = await request(app)
            .post('/api/orders/checkout/webhook')
            .set('stripe-signature', 'valid_sig')
            .send(fakeEvent);

        expect(res.status).toBe(200);
        expect(res.body.received).toBe(true);

        // Verificar que completeOrder se ejecutó: findByIdWithItems + updateStatus
        expect(orderRepository.findByIdWithItems).toHaveBeenCalledWith('42');
        expect(orderRepository.updateStatus).toHaveBeenCalledWith(
            '42', 'completada', expect.any(Object)
        );

        // Verificar que se creó la factura
        expect(invoiceRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ fk_id_vent: '42' }),
            expect.any(Object)
        );

        // Verificar outbox events: uno por cada ítem (inventory.movement) + factus.invoice
        expect(orderRepository.insertOutboxEvent).toHaveBeenCalledTimes(3);
        expect(orderRepository.insertOutboxEvent).toHaveBeenCalledWith(
            'inventory.movement',
            expect.objectContaining({ tipo_mov: 'salida', cod_prod: 'PROD-001' }),
            expect.any(Object)
        );
        expect(orderRepository.insertOutboxEvent).toHaveBeenCalledWith(
            'inventory.movement',
            expect.objectContaining({ tipo_mov: 'salida', cod_prod: 'PROD-002' }),
            expect.any(Object)
        );
        expect(orderRepository.insertOutboxEvent).toHaveBeenCalledWith(
            'factus.invoice',
            expect.objectContaining({ orderId: 42 }),
            expect.any(Object)
        );

        // Verificar transacción BD
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

        // Verificar que se guardó el stripe_payment_id
        expect(orderRepository.updatePaymentInfo).toHaveBeenCalledWith('42', 'pi_test_456');
    });

    test('ROLLBACK si ocurre error en completeOrder', async () => {
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

        // Simular error en el updateStatus dentro de completeOrder
        orderRepository.updateStatus.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app)
            .post('/api/orders/checkout/webhook')
            .set('stripe-signature', 'valid_sig')
            .send(fakeEvent);

        expect(res.status).toBe(500);
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
    });
});
