import { Request, Response, NextFunction } from 'express';

const parseFormData = (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body.fk_cod_cats === 'string') {
        try {
            const parsed = JSON.parse(req.body.fk_cod_cats);
            req.body.fk_cod_cats = Array.isArray(parsed)
                ? parsed.map(Number)
                : [Number(parsed)];
        } catch {
            // No mutar si falla. Dejar que Joi lo detecte como tipo inválido y lance un 400 Bad Request.
        }
    }
    next();
};

export default parseFormData;
