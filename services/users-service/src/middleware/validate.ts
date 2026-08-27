import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';

const validate = (schema: Schema) => (req: Request, res: Response, next: NextFunction): any => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        const messages = error.details.map((d) => d.message).join(', ');
        return res.status(400).json({ error: messages });
    }

    next();
};

export default validate;
