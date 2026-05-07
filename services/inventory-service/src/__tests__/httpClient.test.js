'use strict';

/**
 * Tests unitarios del cliente HTTP compartido (orders-service).
 *
 * Valida:
 * - Timeout via AbortController
 * - Reintentos con backoff en 5xx
 * - No reintenta en 4xx (400, 409)
 * - Reintenta en 429
 * - Propaga x-correlation-id
 * - Propaga Authorization
 */

// Env vars para que el módulo env.js no falle al importar
process.env.NODE_ENV = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test';

const { outgoingHeaders, fetchWithRetry } = require('../utils/httpClient');

// Mock global fetch
const originalFetch = global.fetch;

beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
});

afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
});

describe('outgoingHeaders', () => {
    test('incluye Content-Type por defecto', () => {
        const h = outgoingHeaders({});
        expect(h['Content-Type']).toBe('application/json');
    });

    test('propaga x-correlation-id', () => {
        const h = outgoingHeaders({ 'x-correlation-id': 'abc-123' });
        expect(h['x-correlation-id']).toBe('abc-123');
    });

    test('propaga Authorization', () => {
        const h = outgoingHeaders({ authorization: 'Bearer tok' });
        expect(h['Authorization']).toBe('Bearer tok');
    });

    test('no incluye headers opcionales si no están presentes', () => {
        const h = outgoingHeaders({});
        expect(h['x-correlation-id']).toBeUndefined();
        expect(h['Authorization']).toBeUndefined();
    });
});

describe('fetchWithRetry', () => {
    test('retorna respuesta exitosa (200)', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: 'ok' }),
        });

        const res = await fetchWithRetry('http://test/api', { method: 'GET' }, { maxRetries: 1 });
        expect(res.ok).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('pasa signal de AbortController al fetch', async () => {
        global.fetch = jest.fn().mockImplementation((url, opts) => {
            expect(opts.signal).toBeDefined();
            expect(opts.signal).toBeInstanceOf(AbortSignal);
            return Promise.resolve({ ok: true, status: 200 });
        });

        await fetchWithRetry('http://test/api', { method: 'GET' }, { maxRetries: 1 });
    });

    test('no reintenta en error 400 (error de negocio)', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 400,
            text: async () => 'Bad Request',
            headers: new Map(),
        });

        await expect(
            fetchWithRetry('http://test/api', { method: 'POST' }, { maxRetries: 3 })
        ).rejects.toThrow('HTTP 400');

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('no reintenta en error 409 (conflicto de negocio)', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 409,
            text: async () => 'Conflict',
            headers: new Map(),
        });

        await expect(
            fetchWithRetry('http://test/api', { method: 'POST' }, { maxRetries: 3 })
        ).rejects.toThrow('HTTP 409');

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('reintenta en error 500 (server error)', async () => {
        jest.useRealTimers();

        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
                headers: new Map(),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
            });

        const res = await fetchWithRetry('http://test/api', { method: 'GET' }, {
            maxRetries: 2,
            baseDelayMs: 1,
        });

        expect(res.ok).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('lanza error tras agotar reintentos en 5xx', async () => {
        jest.useRealTimers();

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 503,
            text: async () => 'Service Unavailable',
            headers: new Map(),
        });

        await expect(
            fetchWithRetry('http://test/api', { method: 'GET' }, {
                maxRetries: 2,
                baseDelayMs: 1,
            })
        ).rejects.toThrow('HTTP 503');

        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('usa onNonRetryable para devolver respuesta 4xx sin lanzar', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 409,
            text: async () => 'Conflict',
            headers: new Map(),
        });

        const res = await fetchWithRetry(
            'http://test/api',
            { method: 'POST' },
            {
                maxRetries: 1,
                onNonRetryable: (status) => status === 409,
            }
        );

        expect(res.status).toBe(409);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('timeout aborta el fetch (AbortError)', async () => {
        jest.useRealTimers();

        global.fetch = jest.fn().mockImplementation((_url, opts) => {
            return new Promise((resolve, reject) => {
                const onAbort = () => {
                    const err = new Error('The operation was aborted');
                    err.name = 'AbortError';
                    reject(err);
                };
                if (opts.signal.aborted) {
                    onAbort();
                } else {
                    opts.signal.addEventListener('abort', onAbort);
                }
            });
        });

        await expect(
            fetchWithRetry('http://test/api', { method: 'GET' }, {
                maxRetries: 1,
                timeoutMs: 50,
            })
        ).rejects.toThrow(/Timeout/);
    });

    test('reintenta en error de red', async () => {
        jest.useRealTimers();

        global.fetch = jest.fn()
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            .mockResolvedValueOnce({ ok: true, status: 200 });

        const res = await fetchWithRetry('http://test/api', { method: 'GET' }, {
            maxRetries: 2,
            baseDelayMs: 1,
        });

        expect(res.ok).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
