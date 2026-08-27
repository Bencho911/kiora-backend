import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import './config/env';
import logger from './config/logger';

import path from 'path';

const app = express();

app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(cors({
    origin: (origin: any, callback: any) => callback(null, origin || '*'),
    credentials: true,
}));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

import correlationMiddleware from './middlewares/correlationMiddleware';
app.use(correlationMiddleware);

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'products-service' });
});

import promClient from 'prom-client';
promClient.collectDefaultMetrics({ prefix: 'products_' });

const httpDuration = new promClient.Histogram({
    name: 'products_http_request_duration_seconds',
    help: 'Duración de requests HTTP en products-service',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

app.use((req: Request, res: Response, next: NextFunction) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
        end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
    });
    next();
});

app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

import db from './config/db';
app.get('/health/ready', async (_req: Request, res: Response) => {
    try {
        await db.query('SELECT 1');
        res.status(200).json({ status: 'ready', checks: { postgres: true } });
    } catch (err: unknown) {
        logger.warn('Readiness check falló', { error: (err as Error).message });
        res.status(503).json({ status: 'not_ready', error: 'PostgreSQL no responde.' });
    }
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Kiora — Products Service',
}));
app.get('/api/docs.json', (_req: Request, res: Response) => res.json(swaggerSpec));

import productRoutes from './routes/productRoutes';
import categoryRoutes from './routes/categoryRoutes';

app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Error no controlado', { message: (err as Error).message, stack: (err as Error).stack });
    res.status((err as any).status || 500).json({
        error: (err as any).status ? (err as Error).message : 'Error interno del servidor.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { stack: (err as Error).stack } : undefined,
    });
});

export default app;
