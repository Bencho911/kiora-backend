import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';

const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor.';

    logger.error(message, {
        status,
        method: req.method,
        url: req.originalUrl,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });

    res.status(status).json({ error: message });
};

export default errorHandler;