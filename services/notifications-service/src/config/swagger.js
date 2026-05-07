'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kiora — Notifications Service API',
            version: '1.0.0',
            description: 'API de notificaciones y alertas.',
        },
        servers: [
            { url: 'http://localhost:3005', description: 'Desarrollo local' },
        ],
        tags: [
            { name: 'Alertas', description: 'Historial de alertas' },
        ],
        paths: {
            '/api/notifications/alerts': {
                get: {
                    tags: ['Alertas'],
                    summary: 'Listar alertas',
                    parameters: [
                        { name: 'limit', in: 'query', schema: { type: 'integer' } },
                        { name: 'offset', in: 'query', schema: { type: 'integer' } },
                        { name: 'leida', in: 'query', schema: { type: 'boolean' } },
                    ],
                    responses: {
                        200: { description: 'Lista de alertas' },
                    },
                },
            },
            '/api/notifications/alerts/{id}/read': {
                patch: {
                    tags: ['Alertas'],
                    summary: 'Marcar alerta como leída',
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
                    ],
                    responses: {
                        200: { description: 'Alerta actualizada' },
                        404: { description: 'Alerta no encontrada' },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
