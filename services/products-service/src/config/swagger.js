'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

/**
 * swagger.js
 * Configuración Swagger/OpenAPI del products-service.
 * Accesible en: GET /api/docs
 */
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kiora — Products Service API',
            version: '1.0.0',
            description: [
                'API de catálogo de productos y categorías para el sistema Kiora.',
                '',
                '**Historias de usuario cubiertas**',
                '- HU10 — Registrar productos',
                '- HU11 — Actualizar productos',
                '- HU12 — Consultar productos',
                '- HU13 — Eliminar productos',
                '- HU15 — Ver detalles de producto',
                '',
                '**Base de datos**',
                '- Propietario exclusivo de las tablas `Producto` y `Categoria`.',
                '- Otros servicios referencian `cod_prod` como INT sin FK de BD.',
                '',
                '**Operación**',
                '- Liveness: `GET /health`',
                '- Readiness: `GET /health/ready` (verifica PostgreSQL)',
            ].join('\n'),
        },
        servers: [
            { url: 'http://localhost:3002', description: 'Desarrollo local' },
        ],
        tags: [
            { name: 'Productos',  description: 'CRUD del catálogo de productos (HU10–HU13, HU15)' },
            { name: 'Categorías', description: 'CRUD de categorías de producto' },
            { name: 'Sistema',    description: 'Health checks' },
        ],
        paths: {
            '/health': {
                get: {
                    tags: ['Sistema'],
                    summary: 'Liveness',
                    responses: {
                        200: {
                            description: 'Servicio vivo',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status:  { type: 'string', example: 'ok' },
                                            service: { type: 'string', example: 'products-service' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/health/ready': {
                get: {
                    tags: ['Sistema'],
                    summary: 'Readiness (verifica PostgreSQL)',
                    responses: {
                        200: {
                            description: 'PostgreSQL disponible',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'string', example: 'ready' },
                                            checks: {
                                                type: 'object',
                                                properties: {
                                                    postgres: { type: 'boolean' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        503: { description: 'PostgreSQL no responde' },
                    },
                },
            },
        },
        components: {
            schemas: {
                Producto: {
                    type: 'object',
                    properties: {
                        cod_prod:        { type: 'integer', example: 1 },
                        nom_prod:        { type: 'string',  example: 'Leche Entera' },
                        descrip_prod:    { type: 'string',  example: 'Leche entera pasteurizada 1L' },
                        precio_unitario: { type: 'number',  example: 2.50 },
                        fechaven_prod:   { type: 'string',  format: 'date', example: '2025-12-31' },
                        fk_cod_cat:      { type: 'integer', example: 1 },
                        nom_cat:         { type: 'string',  example: 'Lácteos' },
                    },
                },
                ProductoInput: {
                    type: 'object',
                    required: ['nom_prod', 'precio_unitario'],
                    properties: {
                        nom_prod:        { type: 'string',  example: 'Leche Entera' },
                        descrip_prod:    { type: 'string',  example: 'Leche entera pasteurizada 1L' },
                        precio_unitario: { type: 'number',  minimum: 0, example: 2.50 },
                        fechaven_prod:   { type: 'string',  format: 'date', example: '2025-12-31' },
                        fk_cod_cat:      { type: 'integer', example: 1 },
                    },
                },
                Categoria: {
                    type: 'object',
                    properties: {
                        cod_cat:    { type: 'integer', example: 1 },
                        nom_cat:    { type: 'string',  example: 'Lácteos' },
                        descrip_cat:{ type: 'string',  example: 'Productos derivados de la leche' },
                    },
                },
                CategoriaInput: {
                    type: 'object',
                    required: ['nom_cat'],
                    properties: {
                        nom_cat:    { type: 'string', example: 'Lácteos' },
                        descrip_cat:{ type: 'string', example: 'Productos derivados de la leche' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', example: 'Producto no encontrado.' },
                    },
                },
            },
        },
    },
    // Escanea las rutas en busca de comentarios @swagger
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
