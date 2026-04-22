'use strict';

const Joi = require('joi');

const createProductSchema = Joi.object({
    nom_prod: Joi.string().max(100).required().messages({
        'any.required': 'nom_prod es obligatorio.',
        'string.max': 'nom_prod no debe exceder 100 caracteres.',
    }),
    descrip_prod: Joi.string().allow('', null).optional(),
    precio_unitario: Joi.number().min(0).required().messages({
        'any.required': 'precio_unitario es obligatorio.',
        'number.min': 'El precio_unitario no puede ser negativo.',
    }),
    fechaven_prod: Joi.date().iso().allow(null).optional().messages({
        'date.format': 'fechaven_prod debe ser una fecha válida (ISO 8601).',
    }),
    stock_minimo: Joi.number().integer().min(0).default(0).messages({
        'number.min': 'stock_minimo no puede ser negativo.',
    }),
    fk_cod_cats: Joi.any().optional(),
});

const updateProductSchema = Joi.object({
    nom_prod: Joi.string().max(100).messages({
        'string.max': 'nom_prod no debe exceder 100 caracteres.',
    }),
    descrip_prod: Joi.string().allow('', null),
    precio_unitario: Joi.number().min(0).messages({
        'number.min': 'El precio_unitario no puede ser negativo.',
    }),
    fechaven_prod: Joi.date().iso().allow(null).messages({
        'date.format': 'fechaven_prod debe ser una fecha válida (ISO 8601).',
    }),
    fk_cod_cats: Joi.any().optional(),
    stock_actual: Joi.number().integer().min(0).messages({
        'number.min': 'stock_actual no puede ser negativo.',
    }),
    stock_minimo: Joi.number().integer().min(0).messages({
        'number.min': 'stock_minimo no puede ser negativo.',
    }),
}).min(1).messages({
    'object.min': 'Debes enviar al menos un campo para actualizar.',
});

const updateStockSchema = Joi.object({
    cantidad: Joi.number().integer().required().messages({
        'any.required': 'cantidad es obligatorio.',
        'number.base': 'cantidad debe ser un número entero.',
        'number.integer': 'cantidad debe ser un número entero.',
    }),
});

module.exports = {
    createProductSchema,
    updateProductSchema,
    updateStockSchema,
};
