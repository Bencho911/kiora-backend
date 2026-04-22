'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-smoke-tests';

const request = require('supertest');
const app = require('../app');

describe('API Gateway (smoke)', () => {
    test('GET /health responde 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status');
    });

    test('x-correlation-id se genera o respeta en respuesta', async () => {
        const res = await request(app)
            .get('/health')
            .set('x-correlation-id', 'test-correlation-123');
        expect(res.status).toBe(200);
        expect(res.headers['x-correlation-id']).toBe('test-correlation-123');
    });

    test('GET /api/docs.json sin svc devuelve 400', async () => {
        const res = await request(app).get('/api/docs.json');
        expect(res.status).toBe(400);
    });
});
