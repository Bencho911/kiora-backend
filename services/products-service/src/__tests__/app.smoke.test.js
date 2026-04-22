'use strict';

process.env.NODE_ENV = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test';

jest.mock('../config/db', () => ({
    query: jest.fn(),
}));

const request = require('supertest');
const db = require('../config/db');
const app = require('../app');

describe('products-service (smoke)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('GET /health', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.service).toBe('products-service');
    });

    test('GET /health/ready con Postgres OK', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
        const res = await request(app).get('/health/ready');
        expect(res.status).toBe(200);
        expect(res.body.checks.postgres).toBe(true);
    });

    test('GET /api/products lista paginada (mock DB)', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ cod_prod: 1, nom_prod: 'Test', nom_cat: 'Cat' }] })
            .mockResolvedValueOnce({ rows: [{ count: '1' }] });
        const res = await request(app).get('/api/products');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.pagination.total).toBe(1);
    });
});
