'use strict';

/**
 * Middleware genérico de validación con Joi.
 * Valida req.body contra el schema proporcionado.
 * Responde con formato estandarizado { error, code, details }.
 *
 * @param {import('joi').Schema} schema — Schema Joi a validar
 * @param {'body'|'query'|'params'} source — Fuente de datos (default: 'body')
 */
const validate = (schema, source = 'body') => (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        return res.status(400).json({
            error: 'Error de validación.',
            code: 'VALIDATION_ERROR',
            details: error.details.map((d) => ({
                field: d.context?.key,
                message: d.message,
            })),
        });
    }

    req[source] = value;
    next();
};

module.exports = validate;
