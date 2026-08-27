'use strict';

/**
 * correlationMiddleware.js
 *
 * Extrae el x-correlation-id del request entrante (propagado por el API Gateway)
 * y lo almacena en el AsyncLocalStorage para que Winston lo inyecte automáticamente
 * en cada línea de log durante todo el ciclo de vida del request.
 *
 * Si no viene correlation-id (ej: llamada directa sin gateway), genera uno con crypto.
 */
import crypto from 'crypto';
import asyncContext from '../utils/asyncContext';
import { Request, Response, NextFunction } from 'express';

const correlationMiddleware = (req: Request, _res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
    const store = new Map<string, string | string[]>([['correlationId', correlationId as string]]);
    asyncContext.run(store, () => next());
};

export default correlationMiddleware;
