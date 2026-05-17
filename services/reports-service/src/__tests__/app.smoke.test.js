'use strict';

process.env.NODE_ENV = 'test';
process.env.ORDERS_SERVICE_URL = 'http://localhost:3004';

const request = require('supertest');
const app = require('../app');

describe('reports-service (smoke)', () => {
    test('GET /api/reports/health responde 200', async () => {
        const res = await request(app).get('/api/reports/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
    });
});
