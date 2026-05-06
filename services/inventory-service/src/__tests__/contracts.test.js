'use strict';

/**
 * Tests de contrato ligeros (inventory-service → products-service).
 *
 * Verifica que:
 * - registerMovement() llama la ruta correcta: PUT /api/products/:cod_prod/stock
 * - El body enviado tiene el schema esperado: { cantidad } (delta)
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
process.env.PRODUCTS_SERVICE_URL = 'http://products:3002';

jest.mock('../config/db', () => ({
    query: jest.fn(),
}));

jest.mock('../repositories/inventoryRepository');
jest.mock('../services/directEmailService', () => ({
    sendLowStockEmail: jest.fn(),
}));
jest.mock('../services/redisService', () => ({
    emitLowStockAlert: jest.fn(),
}));

const inventoryRepository = require('../repositories/inventoryRepository');
const originalFetch = global.fetch;

describe('contracts: inventory → products', () => {
    let fetchCalls;

    beforeEach(() => {
        jest.clearAllMocks();
        fetchCalls = [];

        inventoryRepository.createMovement.mockResolvedValue({
            rows: [{ id_mov: 1, tipo_mov: 'entrada', cod_prod: 'PROD-001' }],
        });

        inventoryRepository.updateStock.mockResolvedValue({
            rows: [{ stock: 50, stock_minimo: 10, fk_cod_prov: 1 }],
        });

        global.fetch = jest.fn().mockImplementation((url, opts) => {
            fetchCalls.push({ url, opts });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ stock_actual: 50 }),
                text: async () => '{}',
            });
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('registerMovement() de entrada llama PUT /api/products/:cod_prod/stock con delta positivo', async () => {
        const { registerMovement } = require('../services/inventoryService');

        const reqHeaders = { 'x-correlation-id': 'corr-inv-123' };
        await registerMovement(
            {
                tipo_mov: 'entrada',
                cantidad: 10,
                cod_prod: 'PROD-001',
                fk_cod_prov: 1,
                desc_mov: 'Test entrada',
            },
            reqHeaders
        );

        // Buscar la llamada a products-service
        const productsCalls = fetchCalls.filter(c =>
            c.url.includes('/api/products/PROD-001/stock')
        );

        expect(productsCalls.length).toBeGreaterThanOrEqual(1);

        // Verificar ruta exacta
        expect(productsCalls[0].url).toBe('http://products:3002/api/products/PROD-001/stock');

        // Verificar método PUT
        expect(productsCalls[0].opts.method).toBe('PUT');

        // Verificar body: delta positivo para entrada
        const body = JSON.parse(productsCalls[0].opts.body);
        expect(body).toEqual({ cantidad: 10 });

        // Verificar propagación de correlation-id
        expect(productsCalls[0].opts.headers['x-correlation-id']).toBe('corr-inv-123');
    });

    test('registerMovement() de salida envía delta negativo', async () => {
        jest.resetModules();

        process.env.NODE_ENV = 'test';
        process.env.DB_USER = 'test';
        process.env.DB_PASSWORD = 'test';
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test';
        process.env.PRODUCTS_SERVICE_URL = 'http://products:3002';

        jest.mock('../config/db', () => ({ query: jest.fn() }));
        jest.mock('../repositories/inventoryRepository');
        jest.mock('../services/directEmailService', () => ({
            sendLowStockEmail: jest.fn(),
        }));
        jest.mock('../services/redisService', () => ({
            emitLowStockAlert: jest.fn(),
        }));

        const invRepo = require('../repositories/inventoryRepository');
        invRepo.createMovement.mockResolvedValue({
            rows: [{ id_mov: 2, tipo_mov: 'salida', cod_prod: 'PROD-002' }],
        });
        invRepo.updateStock.mockResolvedValue({
            rows: [{ stock: 40, stock_minimo: 10, fk_cod_prov: 1 }],
        });

        const localCalls = [];
        global.fetch = jest.fn().mockImplementation((url, opts) => {
            localCalls.push({ url, opts });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ stock_actual: 40 }),
                text: async () => '{}',
            });
        });

        const { registerMovement } = require('../services/inventoryService');

        await registerMovement(
            {
                tipo_mov: 'salida',
                cantidad: 5,
                cod_prod: 'PROD-002',
                desc_mov: 'Test salida',
            },
            {}
        );

        const productsCalls = localCalls.filter(c =>
            c.url.includes('/api/products/PROD-002/stock')
        );

        expect(productsCalls.length).toBeGreaterThanOrEqual(1);
        const body = JSON.parse(productsCalls[0].opts.body);
        expect(body).toEqual({ cantidad: -5 }); // Delta negativo para salida
    });
});
