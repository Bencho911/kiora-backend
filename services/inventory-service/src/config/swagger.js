'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

/**
 * swagger.js
 * Configuración Swagger/OpenAPI del inventory-service.
 * Accesible en: GET /api/docs
 */
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kiora — Inventory Service API',
            version: '1.0.0',
            description: [
                'API de inventario, proveedores y control de stock para el sistema Kiora.',
                '',
                '**Historias de usuario cubiertas**',
                '- HU14 — Configurar stock mínimo por proveedor-producto',
                '',
                '**Base de datos**',
                '- Propietario de las tablas `Proveedor`, `Inventario` y `Suministra`.',
                '- Referencia a `cod_prod` (products-service) como INT sin FK de BD.',
                '',
                '**Alerta de stock mínimo**',
                '- `POST /api/inventory/suministra` devuelve `alerta_stock_minimo: true` cuando `stock < stock_minimo`.',
                '- `GET /api/inventory/low-stock` lista todos los items en alerta.',
                '',
                '**Operación**',
                '- Liveness: `GET /health`',
                '- Readiness: `GET /health/ready` (verifica PostgreSQL)',
            ].join('\n'),
        },
        servers: [
            { url: 'http://localhost:3003', description: 'Desarrollo local' },
        ],
        tags: [
            { name: 'Proveedores', description: 'CRUD de proveedores' },
            { name: 'Movimientos', description: 'Movimientos de stock (entradas / salidas / ajustes)' },
            { name: 'Suministra',  description: 'Stock por proveedor-producto con stock mínimo (HU14)' },
            { name: 'Sistema',     description: 'Health checks' },
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
                                            service: { type: 'string', example: 'inventory-service' },
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
                        200: { description: 'PostgreSQL disponible' },
                        503: { description: 'PostgreSQL no responde' },
                    },
                },
            },
        },
        components: {
            schemas: {
                Proveedor: {
                    type: 'object',
                    properties: {
                        cod_prov:    { type: 'integer', example: 1 },
                        id_prov:     { type: 'string',  example: 'NIT-123456' },
                        nom_prov:    { type: 'string',  example: 'Distribuidora Andina' },
                        tel_prov:    { type: 'string',  example: '601-555-0100' },
                        tipoid_prov: { type: 'string',  example: 'NIT' },
                    },
                },
                ProveedorInput: {
                    type: 'object',
                    required: ['nom_prov'],
                    properties: {
                        nom_prov:    { type: 'string', example: 'Distribuidora Andina' },
                        id_prov:     { type: 'string', example: 'NIT-123456' },
                        tel_prov:    { type: 'string', example: '601-555-0100' },
                        tipoid_prov: { type: 'string', example: 'NIT' },
                    },
                },
                Movimiento: {
                    type: 'object',
                    properties: {
                        id_mov:    { type: 'integer', example: 1 },
                        tipo_mov:  { type: 'string',  enum: ['entrada', 'salida', 'ajuste'] },
                        fecha_mov: { type: 'string',  format: 'date', example: '2026-03-31' },
                        cantidad:  { type: 'integer', example: 50 },
                        cod_prod:  { type: 'integer', example: 1 },
                    },
                },
                MovimientoInput: {
                    type: 'object',
                    required: ['tipo_mov', 'cantidad', 'cod_prod'],
                    properties: {
                        tipo_mov:  { type: 'string', enum: ['entrada', 'salida', 'ajuste'] },
                        cantidad:  { type: 'integer', minimum: 1, example: 50 },
                        cod_prod:  { type: 'integer', example: 1 },
                        fecha_mov: { type: 'string',  format: 'date', example: '2026-03-31' },
                    },
                },
                Suministra: {
                    type: 'object',
                    properties: {
                        id:           { type: 'integer', example: 1 },
                        fk_cod_prov:  { type: 'integer', example: 1 },
                        cod_prod:     { type: 'integer', example: 1 },
                        stock:        { type: 'integer', example: 5 },
                        stock_minimo: { type: 'integer', example: 10 },
                        nom_prov:     { type: 'string',  example: 'Distribuidora Andina' },
                    },
                },
                SuministraInput: {
                    type: 'object',
                    required: ['fk_cod_prov', 'cod_prod'],
                    properties: {
                        fk_cod_prov:  { type: 'integer', example: 1 },
                        cod_prod:     { type: 'integer', example: 1 },
                        stock:        { type: 'integer', minimum: 0, default: 0, example: 5 },
                        stock_minimo: { type: 'integer', minimum: 0, default: 0, example: 10 },
                    },
                },
                SuministraResponse: {
                    allOf: [
                        { '$ref': '#/components/schemas/Suministra' },
                        {
                            type: 'object',
                            properties: {
                                alerta_stock_minimo: { type: 'boolean', example: true },
                                mensaje: {
                                    type: 'string',
                                    example: '⚠️ Stock actual (5) está por debajo del mínimo configurado (10).',
                                },
                            },
                        },
                    ],
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', example: 'Proveedor no encontrado.' },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
