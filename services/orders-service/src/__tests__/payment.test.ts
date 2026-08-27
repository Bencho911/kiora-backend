export {};
'use strict';

/**
 * Tests del controlador de pagos (Wompi Webhook).
 *
 * Verifica que handleWompiWebhook:
 * - Rechaza firmas inválidas con 401
 * - Completa la orden automáticamente (status → completada + outbox events)
 * - Guarda wopi_transaction_id
 */

process.env.NODE_ENV = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test';

const wompiService = require('../services/wompiService');
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
let mockClient: any;

const request = require('supertest');
const app = require('../app').default;

describe('Wompi Webhook (handleWompiWebhook)', () => {
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

    test('401 cuando la firma es inválida', async () => {
        jest.spyOn(wompiService, 'verifyWebhookSignature').mockImplementationOnce(() => {
            throw new Error('Firma de Wompi inválida.');
        });

        const res = await request(app)
            .post('/api/orders/checkout/webhook/wompi')
            .send({ event: 'transaction.updated' });

        expect(res.status).toBe(401);
        expect(res.text).toContain('Webhook Error');
    });

    test('200 – completa la orden y guarda payment info', async () => {
        const fakeEvent = {
            event: 'transaction.updated',
            data: {
                transaction: {
                    id: 'wompi_test_123',
                    reference: 'KIORA-42',
                    status: 'APPROVED',
                    payment_method_type: 'CARD'
                },
            },
        };

        jest.spyOn(wompiService, 'verifyWebhookSignature').mockReturnValue(true);

        const res = await request(app)
            .post('/api/orders/checkout/webhook/wompi')
            .send(fakeEvent);

        expect(res.status).toBe(200);
        expect(res.body.received).toBe(true);

        // Verificar que completeOrder se ejecutó: findByIdWithItems + updateStatus
        expect(orderRepository.findByIdWithItems).toHaveBeenCalledWith(42);
        expect(orderRepository.updateStatus).toHaveBeenCalledWith(
            42, 'completada', expect.any(Object)
        );

        // Verificar que se creó la factura
        expect(invoiceRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ fk_id_vent: 42 }),
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

        // Verificar que el wompi_transaction_id se guardó DENTRO de la transacción
        // (UPDATE directo en la transacción de completeOrder, no llamada separada)
        expect(mockClient.query).toHaveBeenCalledWith(
            'UPDATE Ventas SET stripe_payment_id = $1, metodopago_usu = $2 WHERE id_vent = $3',
            ['wompi_test_123', 'stripe_tarjeta', 42]
        );
    });

    test('ROLLBACK si ocurre error en completeOrder', async () => {
        const fakeEvent = {
            event: 'transaction.updated',
            data: {
                transaction: {
                    id: 'wompi_test_456',
                    reference: 'KIORA-42',
                    status: 'APPROVED',
                    payment_method_type: 'CARD'
                },
            },
        };

        jest.spyOn(wompiService, 'verifyWebhookSignature').mockReturnValue(true);

        // Simular error en el updateStatus dentro de completeOrder
        orderRepository.updateStatus.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app)
            .post('/api/orders/checkout/webhook/wompi')
            .send(fakeEvent);

        expect(res.status).toBe(500);
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
    });
});
