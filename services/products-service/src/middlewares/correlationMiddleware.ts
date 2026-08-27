import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import asyncContext from '../utils/asyncContext';

const correlationMiddleware = (req: Request, _res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
    const store = new Map([['correlationId', correlationId]]);
    asyncContext.run(store, () => next());
};

export default correlationMiddleware;
