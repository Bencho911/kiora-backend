import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import reportRoutes from './routes/reportRoutes.js';
import electronicInvoiceRoutes from './routes/electronicInvoiceRoutes.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
import correlationMiddleware from './middlewares/correlationMiddleware.js';
app.use(correlationMiddleware);

// Health Check
app.get('/api/reports/health', (req, res) => res.status(200).json({ status: 'OK' }));

// Swagger
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Kiora — Reports Service',
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

app.use('/api/reports/electronic-invoice', electronicInvoiceRoutes);
app.use('/api/reports', reportRoutes);

export default app;
