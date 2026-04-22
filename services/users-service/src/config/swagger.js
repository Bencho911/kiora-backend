const swaggerJsdoc = require('swagger-jsdoc');

/**
 * swagger.js
 * Configuración de Swagger/OpenAPI para la documentación de la API.
 * Accesible en: GET /api/docs
 */
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kiora — Users Service API',
            version: '1.0.0',
            description: [
                'API de autenticación y gestión de usuarios para el sistema Kiora.',
                '',
                '**Tokens**',
                '- Access JWT: header `Authorization: Bearer` (móvil) o cookie HttpOnly `token` (web; en login enviar `x-client-type: web`).',
                '- Refresh: siempre en cookie HttpOnly `kiora_refresh_token`.',
                '- Los JWT incluyen el claim **`sv`** (session_version). Tras **cambiar** o **restablecer** contraseña se incrementa en BD y quedan inválidos access/refresh anteriores.',
                '',
                '**Blacklist (Redis)**',
                '- Con `BLACKLIST_FAIL_OPEN=false`, si Redis no responde al comprobar o guardar revocaciones, las rutas afectadas responden **503**.',
                '',
                '**Operación**',
                '- Liveness: `GET /api/users/health` (solo proceso vivo).',
                '- Readiness: `GET /api/users/ready` (Postgres + Redis; usar en balanceadores).',
            ].join('\n'),
        },
        servers: [
            { url: 'http://localhost:3001', description: 'Desarrollo local' },
        ],
        tags: [
            { name: 'Auth', description: 'Login, sesiones y recuperación de contraseña' },
            { name: 'Usuarios', description: 'Gestión de usuarios (administrador)' },
            { name: 'Sistema', description: 'Salud del proceso y dependencias' },
        ],
        paths: {
            '/api/users/health': {
                get: {
                    tags: ['Sistema'],
                    summary: 'Liveness',
                    description: 'El proceso responde. No verifica base de datos ni Redis.',
                    responses: {
                        200: {
                            description: 'Servicio vivo',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'string', example: 'OK' },
                                            message: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/api/users/ready': {
                get: {
                    tags: ['Sistema'],
                    summary: 'Readiness',
                    description: 'Ejecuta `SELECT 1` en PostgreSQL y `PING` en Redis.',
                    responses: {
                        200: {
                            description: 'Dependencias disponibles',
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
                                                    redis: { type: 'boolean' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        503: {
                            description: 'Postgres o Redis no responden',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'string', example: 'not_ready' },
                                            error: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT de acceso. También puede enviarse vía cookie `token` (cliente web).',
                },
            },
        },
    },
    // Escanea estas rutas en busca de comentarios JSDoc con @swagger
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
