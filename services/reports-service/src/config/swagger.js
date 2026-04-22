const swaggerJSDoc = require('swagger-jsdoc');

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

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
