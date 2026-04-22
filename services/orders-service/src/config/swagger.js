'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kiora — Orders Service API',
            version: '1.0.0',
            description: [
                'API de ventas y facturación para el kiosco Kiora.',
                '',
                '**Tablas**',
                '- `Ventas` — registro principal de venta',
                '- `Producto_Venta` — líneas de detalle (qué productos se vendieron)',
                '- `Factura` — documento fiscal asociado a una venta',
                '',
                '**Flujo normal**',
                '1. `POST /api/orders` — crear venta con sus items',
                '2. `PUT /api/orders/:id/status` — marcar como `completada`',
                '3. `POST /api/orders/invoices` — emitir factura de la venta',
            ].join('\n'),
        },
        servers: [
            { url: 'http://localhost:3004', description: 'Desarrollo local' },
        ],
        tags: [
            { name: 'Ventas',   description: 'CRUD de ventas y cambio de estado' },
            { name: 'Facturas', description: 'Emisión y consulta de facturas' },
            { name: 'Sistema',  description: 'Health checks' },
        ],
        components: {
            schemas: {
                ItemVenta: {
                    type: 'object',
                    required: ['cod_prod', 'cantidad', 'precio_unit'],
                    properties: {
                        cod_prod:   { type: 'integer', example: 1 },
                        cantidad:   { type: 'integer', minimum: 1, example: 2 },
                        precio_unit:{ type: 'number',  minimum: 0, example: 5.00 },
                    },
                },
                VentaInput: {
                    type: 'object',
                    required: ['items'],
                    properties: {
                        metodopago_usu: { type: 'string', example: 'efectivo' },
                        items: {
                            type: 'array',
                            items: { '$ref': '#/components/schemas/ItemVenta' },
                        },
                    },
                },
                Venta: {
                    type: 'object',
                    properties: {
                        id_vent:           { type: 'integer', example: 1 },
                        fecha_vent:        { type: 'string', format: 'date-time' },
                        precio_prod_final: { type: 'number', example: 5.00 },
                        montofinal_vent:   { type: 'number', example: 10.00 },
                        metodopago_usu:    { type: 'string', example: 'efectivo' },
                        estado:            { type: 'string', enum: ['pendiente','completada','cancelada'] },
                        items:             { type: 'array', items: { '$ref': '#/components/schemas/ItemVenta' } },
                    },
                },
                Factura: {
                    type: 'object',
                    properties: {
                        id:            { type: 'integer', example: 1 },
                        fk_id_vent:    { type: 'integer', example: 1 },
                        id_usu:        { type: 'integer', example: 3 },
                        cantidad_vent: { type: 'integer', example: 2 },
                        precio_prod:   { type: 'number',  example: 5.00 },
                        montototal_vent:{ type: 'number', example: 10.00 },
                        emitida_en:    { type: 'string',  format: 'date-time' },
                    },
                },
                FacturaInput: {
                    type: 'object',
                    required: ['fk_id_vent','id_usu','cantidad_vent','precio_prod','montototal_vent'],
                    properties: {
                        fk_id_vent:    { type: 'integer', example: 1 },
                        id_usu:        { type: 'integer', example: 3 },
                        cantidad_vent: { type: 'integer', minimum: 1, example: 2 },
                        precio_prod:   { type: 'number',  minimum: 0, example: 5.00 },
                        montototal_vent:{ type: 'number', minimum: 0, example: 10.00 },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
                Paginado: {
                    type: 'object',
                    properties: {
                        data:       { type: 'array', items: {} },
                        total:      { type: 'integer' },
                        page:       { type: 'integer' },
                        totalPages: { type: 'integer' },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
