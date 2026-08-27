import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import pool from './config/db';
import * as blacklist from './config/blacklist';
import logger from './config/logger';
import authRoutes from './routes/authRoutes';
import incidentsRoutes from './routes/incidentsRoutes';
import errorHandler from './middleware/errorHandler';
import correlationMiddleware from './middleware/correlationMiddleware';
import settingsRoutes from './routes/settingsRoutes';

const app = express();

app.use(helmet());

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-type'],
    credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

app.use(correlationMiddleware);

app.get('/api/users/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', message: 'Users Service Kiora está corriendo' });
});

app.get('/api/users/ready', async (req: Request, res: Response): Promise<any> => {
    try {
        await pool.query('SELECT 1');
        await blacklist.ping();
        res.status(200).json({
            status: 'ready',
            checks: { postgres: true, redis: true },
        });
    } catch (err: unknown) {
        logger.warn('Readiness check falló', { error: (err as Error).message });
        res.status(503).json({
            status: 'not_ready',
            error: 'Una o más dependencias no responden.',
        });
    }
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/users/docs-json', (req: Request, res: Response) => res.json(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/settings', settingsRoutes);

app.use(errorHandler);

export default app;
