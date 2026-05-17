'use strict';

/**
 * Tests unitarios del Outbox Poller.
 *
 * Valida:
 * - processEvent con inventory.movement (exito, error 4xx, error 5xx)
 * - processEvent con inventory.reserve.commit (exito, error red)
 * - processEvent con tipo desconocido
 */

process.env.NODE_ENV = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test';
process.env.INVENTORY_SERVICE_URL = 'http://inventory:3003';

const originalFetch = global.fetch;

beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
});

afterEach(() => {
    global.fetch = originalFetch;
});

describe('processEvent', () => {
    test('inventory.movement exitoso retorna ok=true', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201 });

        const { processEvent } = require('../services/outboxPoller');
        const result = await processEvent({
            id: 1,
            event_type: 'inventory.movement',
            payload: { tipo_mov: 'salida', cantidad: 2, cod_prod: 1 },
        });

        expect(result).toEqual({ ok: true });
        expect(global.fetch).toHaveBeenCalledWith(
            'http://inventory:3003/api/inventory/movements',
            expect.objectContaining({ method: 'POST' })
        );
    });

    test('inventory.movement con 409 retorna businessError=true', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 409,
            text: async () => 'Conflict',
            headers: new Map(),
        });

        const { processEvent } = require('../services/outboxPoller');
        const result = await processEvent({
            id: 2,
            event_type: 'inventory.movement',
            payload: { tipo_mov: 'salida', cantidad: 5, cod_prod: 99 },
        });

        expect(result).toEqual({ ok: false, businessError: true });
    });

    test('inventory.movement con 503 retorna businessError=false (reintentar)', async () => {
        jest.useFakeTimers();

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 503,
            text: async () => 'Service Unavailable',
            headers: new Map(),
        });

        const { processEvent } = require('../services/outboxPoller');
        const result = await processEvent({
            id: 3,
            event_type: 'inventory.movement',
            payload: { tipo_mov: 'salida', cantidad: 1, cod_prod: 1 },
        });

        expect(result).toEqual({ ok: false, businessError: false });

        jest.useRealTimers();
    });

    test('inventory.reserve.commit exitoso retorna ok=true', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

        const { processEvent } = require('../services/outboxPoller');
        const result = await processEvent({
            id: 4,
            event_type: 'inventory.reserve.commit',
            payload: { orderId: 42 },
        });

        expect(result).toEqual({ ok: true });
        expect(global.fetch).toHaveBeenCalledWith(
            'http://inventory:3003/api/inventory/saga/reserve/commit',
            expect.objectContaining({ method: 'POST' })
        );
    });

    test('inventory.reserve.commit con error de red retorna businessError=false', async () => {
        jest.useFakeTimers();

        global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

        const { processEvent } = require('../services/outboxPoller');
        const result = await processEvent({
            id: 5,
            event_type: 'inventory.reserve.commit',
            payload: { orderId: 42 },
        });

        expect(result).toEqual({ ok: false, businessError: false });

        jest.useRealTimers();
    });

    test('tipo de evento desconocido retorna ok=true (no bloquea)', async () => {
        const { processEvent } = require('../services/outboxPoller');
        const result = await processEvent({
            id: 99,
            event_type: 'unknown.event',
            payload: {},
        });

        expect(result).toEqual({ ok: true });
    });
});
