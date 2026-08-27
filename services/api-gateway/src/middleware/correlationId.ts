import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { asyncContext } from '../utils/asyncContext';

export const correlationId = (req: Request, res: Response, next: NextFunction) => {
    const id =
        (req.headers['x-correlation-id'] as string) ||
        (req.headers['x-request-id'] as string) ||
        crypto.randomUUID();
    req.headers['x-correlation-id'] = id;
    res.setHeader('x-correlation-id', id);

    // Envolver el request en AsyncLocalStorage para que Winston lo lea
    const store = new Map([['correlationId', id]]);
    asyncContext.run(store, () => next());
};
