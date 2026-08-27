import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';

type Source = 'body' | 'query' | 'params';

const validate = (schema: Schema, source: Source = 'body') => (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        res.status(400).json({
            error: 'Error de validación.',
            code: 'VALIDATION_ERROR',
            details: error.details.map((d) => ({
                field: d.context?.key,
                message: d.message,
            })),
        });
        return;
    }

    req[source] = value;
    next();
};

export default validate;
