"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kiora Reports Service API',
            version: '1.0.0',
            description: 'API para la generación asíncrona y descarga de reportes (Facturas PDF) del sistema Kiora.',
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production'
                    ? 'https://api.kiora.com/api/v1/reports'
                    : `http://localhost:${process.env.PORT || 3006}/api/reports`,
                description: process.env.NODE_ENV === 'production' ? 'Producción' : 'Desarrollo Local',
            },
        ],
    },
    apis: ['./src/routes/*.js', './src/controllers/*.js'],
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(options);
exports.default = swaggerSpec;
