'use strict';

/**
 * Tests de contrato ligeros (orders-service → inventory-service).
 *
 * Verifica que:
 * - completeOrder() llama la ruta correcta: POST /api/inventory/movements
 * - El body enviado tiene el schema esperado: { tipo_mov, cantidad, cod_prod, fk_id_vent, desc_mov }
 * - Se propaga x-correlation-id en los headers
 *
 * Si cambia la ruta o el body schema, este test falla → te avisa que rompiste un contrato.
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
}));

jest.mock('../repositories/orderRepository');
jest.mock('../repositories/invoiceRepository');

const originalFetch = global.fetch;

describe('contracts: orders → inventory', () => {
    let fetchCalls;

    beforeEach(() => {
        jest.clearAllMocks();
        fetchCalls = [];

        global.fetch = jest.fn().mockImplementation((url, opts) => {
            fetchCalls.push({ url, opts });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ id_mov: 1 }),
                text: async () => '{}',
            });
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('completeOrder() llama POST /api/inventory/movements con schema correcto', async () => {
        jest.resetModules();

        process.env.NODE_ENV = 'test';
        process.env.DB_USER = 'test';
        process.env.DB_PASSWORD = 'test';
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test';
        process.env.INVENTORY_SERVICE_URL = 'http://inventory:3003';

        jest.mock('../config/db', () => ({
            query: jest.fn(),
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

        invoiceRepo.create.mockResolvedValue({ rows: [{ id_fact: 1 }] });

        const localFetchCalls = [];
        global.fetch = jest.fn().mockImplementation((url, opts) => {
            localFetchCalls.push({ url, opts });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ id_mov: 1 }),
                text: async () => '{}',
            });
        });

        const { completeOrder } = require('../services/orderService');

        const reqHeaders = { 'x-correlation-id': 'corr-test-123' };
        const result = await completeOrder(42, reqHeaders);

        expect(result.ok).toBe(true);

        // Verificar que las llamadas a inventory usan la ruta correcta
        const inventoryCalls = localFetchCalls.filter(c =>
            c.url.includes('/api/inventory/movements')
        );

        expect(inventoryCalls.length).toBe(2); // Una por cada item

        // Verificar el schema del body de la primera llamada
        const firstCallBody = JSON.parse(inventoryCalls[0].opts.body);
        expect(firstCallBody).toEqual(expect.objectContaining({
            tipo_mov: 'salida',
            cantidad: 2,
            cod_prod: 'PROD-001',
            fk_id_vent: 42,
            desc_mov: expect.stringContaining('Venta #42'),
        }));

        // Verificar ruta exacta
        expect(inventoryCalls[0].url).toBe('http://inventory:3003/api/inventory/movements');

        // Verificar que se propagó x-correlation-id
        const sentHeaders = inventoryCalls[0].opts.headers;
        expect(sentHeaders['x-correlation-id']).toBe('corr-test-123');
    });

    test('completeOrder() envía broadcast a gateway con schema correcto', async () => {
        jest.resetModules();

        process.env.NODE_ENV = 'test';
        process.env.DB_USER = 'test';
        process.env.DB_PASSWORD = 'test';
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test';
        process.env.INVENTORY_SERVICE_URL = 'http://inventory:3003';
        process.env.API_GATEWAY_URL = 'http://gateway:3000';

        jest.mock('../config/db', () => ({
            query: jest.fn(),
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

        invoiceRepo.create.mockResolvedValue({ rows: [{ id_fact: 1 }] });

        const localFetchCalls = [];
        global.fetch = jest.fn().mockImplementation((url, opts) => {
            localFetchCalls.push({ url, opts });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ id_mov: 1 }),
                text: async () => '{}',
            });
        });

        const { completeOrder } = require('../services/orderService');

        await completeOrder(42, {});

        // Buscar la llamada a broadcast
        const broadcastCalls = localFetchCalls.filter(c =>
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
});
