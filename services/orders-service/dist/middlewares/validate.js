'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const validate = (schema, source = 'body') => (req, res, next) => {
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
exports.default = validate;
