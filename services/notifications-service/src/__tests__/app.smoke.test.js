'use strict';

// env.js exige variables antes de cargar app
process.env.NODE_ENV = 'test';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test';
process.env.SMTP_PASS = 'test';
process.env.FROM_EMAIL = 'test@kiora.local';

const request = require('supertest');
const app = require('../app');

describe('notifications-service (smoke)', () => {
    test('GET /health responde 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('notifications-service');
    });
});
