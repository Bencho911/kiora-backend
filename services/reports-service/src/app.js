const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Health Check
app.get('/api/reports/health', (req, res) => res.status(200).json({ status: 'OK' }));

// Swagger
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Kiora — Reports Service',
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

app.use('/api/reports', reportRoutes);

module.exports = app;
