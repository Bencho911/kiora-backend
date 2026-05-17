'use strict';

/**
 * Tests de contrato ligeros (orders-service → inventory-service).
 *
 * Fase 5: Los contratos ahora validan inserciones en la tabla outbox_events
 * en lugar de llamadas HTTP directas, ya que la comunicación es asíncrona.
 *
 * Verifica que:
 * - completeOrder() inserta eventos outbox con el schema correcto
 * - El evento tiene tipo 'inventory.movement' y payload con los campos requeridos
 * - completeOrder() envía broadcast al gateway (sigue siendo síncrono)
 */

process.env.NODE_ENV = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test';
process.env.INVENTORY_SERVICE_URL = 'http://inventory:3003';

jest.mock('../config/db', () => ({
    query: jest.fn(),
    connect: jest.fn(),
}));

jest.mock('../repositories/orderRepository');
jest.mock('../repositories/invoiceRepository');

const originalFetch = global.fetch;

describe('contracts: orders → inventory (Outbox)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('completeOrder() inserta eventos outbox con schema correcto (no HTTP directo)', async () => {
        jest.resetModules();

        process.env.NODE_ENV = 'test';
        process.env.DB_USER = 'test';
        process.env.DB_PASSWORD = 'test';
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test';
        process.env.INVENTORY_SERVICE_URL = 'http://inventory:3003';

        // Mockear db con transacción
        const mockClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };

        jest.mock('../config/db', () => ({
            query: jest.fn(),
            connect: jest.fn().mockResolvedValue(mockClient),
        }));

        jest.mock('../repositories/orderRepository');
        jest.mock('../repositories/invoiceRepository');

        const orderRepo = require('../repositories/orderRepository');
        const invoiceRepo = require('../repositories/invoiceRepository');

        orderRepo.findByIdWithItems.mockResolvedValue({
            id_vent: 42,
            estado: 'pendiente',
            montofinal_vent: 500,
            items: [
                { cod_prod: 'PROD-001', cantidad: 2, precio_unit: 100 },
                { cod_prod: 'PROD-002', cantidad: 1, precio_unit: 300 },
            ],
        });

        orderRepo.updateStatus.mockResolvedValue({
            rows: [{ id_vent: 42, estado: 'completada', montofinal_vent: 500 }],
        });

        orderRepo.insertOutboxEvent.mockResolvedValue({
            rows: [{ id: 1 }],
        });

        invoiceRepo.create.mockResolvedValue({ rows: [{ id_fact: 1 }] });

        // Mock fetch para broadcast (fire & forget)
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => '{}',
        });

        const { completeOrder } = require('../services/orderService');

        const result = await completeOrder(42, { 'x-correlation-id': 'corr-123' });
        expect(result.ok).toBe(true);

        // Verificar que se usó transacción
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

        // Verificar que se insertaron eventos outbox (2 inventory + 1 factus.invoice)
        expect(orderRepo.insertOutboxEvent).toHaveBeenCalledTimes(3);

        // Verificar schema del primer evento outbox
        const firstCall = orderRepo.insertOutboxEvent.mock.calls[0];
        expect(firstCall[0]).toBe('inventory.movement'); // event_type
        expect(firstCall[1]).toEqual(expect.objectContaining({
            tipo_mov: 'salida',
            cantidad: 2,
            cod_prod: 'PROD-001',
            fk_id_vent: 42,
            desc_mov: expect.stringContaining('Venta #42'),
        }));
        expect(firstCall[2]).toBe(mockClient); // Usa el cliente de transacción

        // Verificar que NO se hicieron llamadas HTTP directas a inventory
        const inventoryFetchCalls = global.fetch.mock.calls.filter(
            ([url]) => url.includes('/api/inventory/movements')
        );
        expect(inventoryFetchCalls).toHaveLength(0);
    });

    test('completeOrder() envía broadcast al gateway después del COMMIT', async () => {
        jest.resetModules();

        process.env.NODE_ENV = 'test';
        process.env.DB_USER = 'test';
        process.env.DB_PASSWORD = 'test';
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test';
        process.env.API_GATEWAY_URL = 'http://gateway:3000';

        const mockClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };

        jest.mock('../config/db', () => ({
            query: jest.fn(),
            connect: jest.fn().mockResolvedValue(mockClient),
        }));

        jest.mock('../repositories/orderRepository');
        jest.mock('../repositories/invoiceRepository');

        const orderRepo = require('../repositories/orderRepository');
        const invoiceRepo = require('../repositories/invoiceRepository');

        orderRepo.findByIdWithItems.mockResolvedValue({
            id_vent: 42,
            estado: 'pendiente',
            montofinal_vent: 500,
            items: [{ cod_prod: 'PROD-001', cantidad: 1, precio_unit: 500 }],
        });

        orderRepo.updateStatus.mockResolvedValue({
            rows: [{ id_vent: 42, estado: 'completada', montofinal_vent: 500 }],
        });

        orderRepo.insertOutboxEvent.mockResolvedValue({ rows: [{ id: 1 }] });
        invoiceRepo.create.mockResolvedValue({ rows: [{ id_fact: 1 }] });

        const fetchCalls = [];
        global.fetch = jest.fn().mockImplementation((url, opts) => {
            fetchCalls.push({ url, opts });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({}),
                text: async () => '{}',
            });
        });

        const { completeOrder } = require('../services/orderService');
        await completeOrder(42, {});

        // Buscar la llamada a broadcast
        const broadcastCalls = fetchCalls.filter(c =>
            c.url.includes('/api/internal/broadcast')
        );

        expect(broadcastCalls.length).toBe(1);
        expect(broadcastCalls[0].url).toBe('http://gateway:3000/api/internal/broadcast');

        const broadcastBody = JSON.parse(broadcastCalls[0].opts.body);
        expect(broadcastBody).toEqual(expect.objectContaining({
            event: 'new_sale',
            payload: expect.objectContaining({
                id_vent: 42,
                estado: 'completada',
            }),
        }));
    });

    test('updateStatus(reembolsada) inserta outbox events con tipo_mov=entrada (no HTTP directo)', async () => {
        jest.resetModules();

        process.env.NODE_ENV = 'test';
        process.env.DB_USER = 'test';
        process.env.DB_PASSWORD = 'test';
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test';
        process.env.INVENTORY_SERVICE_URL = 'http://inventory:3003';

        const mockClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };

        jest.mock('../config/db', () => ({
            query: jest.fn(),
            connect: jest.fn().mockResolvedValue(mockClient),
        }));

        jest.mock('../repositories/orderRepository');
        jest.mock('../repositories/invoiceRepository');
        jest.mock('../services/stripeService', () => ({
            createRefund: jest.fn().mockResolvedValue({ id: 'ref_test' }),
        }));

        const orderRepo = require('../repositories/orderRepository');
        const invoiceRepo = require('../repositories/invoiceRepository');

        // Simular una orden completada con items
        orderRepo.findByIdWithItems.mockResolvedValue({
            id_vent: 99,
            estado: 'completada',
            montofinal_vent: 250,
            items: [
                { cod_prod: 'PROD-001', cantidad: 3, precio_unit: 50 },
                { cod_prod: 'PROD-002', cantidad: 1, precio_unit: 100 },
            ],
        });

        orderRepo.updateStatus.mockResolvedValue({
            rows: [{ id_vent: 99, estado: 'reembolsada' }],
        });

        orderRepo.insertOutboxEvent.mockResolvedValue({ rows: [{ id: 1 }] });

        // Mock para buscar factura Factus asociada
        invoiceRepo.findByVentaWithFactus.mockResolvedValue({
            rows: [{ id: 10, fk_id_vent: 99, factus_invoice_number: 'SETP990002744' }],
        });

        // Capturar llamadas HTTP
        const fetchCalls = [];
        global.fetch = jest.fn().mockImplementation((url, opts) => {
            fetchCalls.push({ url, opts });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({}),
                text: async () => '{}',
            });
        });

        const orderService = require('../services/orderService');

        const result = await orderService.updateStatus(99, 'reembolsada', { 'x-correlation-id': 'corr-456' });
        expect(result.ok).toBe(true);
        expect(result.data.estado).toBe('reembolsada');

        // Verificar transacción
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

        // Verificar que se insertaron eventos outbox (2 inventory + 1 factus.credit_note)
        expect(orderRepo.insertOutboxEvent).toHaveBeenCalledTimes(3);

        // Verificar schema del primer evento outbox (debe ser entrada)
        const firstCall = orderRepo.insertOutboxEvent.mock.calls[0];
        expect(firstCall[0]).toBe('inventory.movement');
        expect(firstCall[1]).toEqual(expect.objectContaining({
            tipo_mov: 'entrada',
            cantidad: 3,
            cod_prod: 'PROD-001',
            fk_id_vent: 99,
            desc_mov: expect.stringContaining('REEMBOLSO'),
        }));
        expect(firstCall[2]).toBe(mockClient); // Usa el cliente de transacción

        // Verificar que NO se hicieron llamadas HTTP directas a inventory
        const inventoryHttpCalls = fetchCalls.filter(
            ([url]) => url && url.includes('/api/inventory/movements')
        );
        expect(inventoryHttpCalls).toHaveLength(0);
    });
});
