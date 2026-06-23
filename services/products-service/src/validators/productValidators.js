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
    descuento: Joi.number().min(0).max(100).default(0).messages({
        'number.min': 'descuento no puede ser negativo.',
        'number.max': 'descuento no puede exceder 100.',
    }),
    codigo_barras: Joi.string().pattern(/^[0-9]+$/).allow('', null).max(50).optional().messages({
        'string.pattern.base': 'El código de barras solo puede contener números.',
        'string.max': 'codigo_barras no debe exceder 50 caracteres.',
    }),
    fechaven_prod: Joi.date().iso().allow(null).optional().min('now').messages({
        'date.format': 'fechaven_prod debe ser una fecha válida (ISO 8601).',
        'date.min': 'La fecha de vencimiento no puede ser anterior a hoy.',
    }),
    stock_actual: Joi.number().integer().min(0).required().messages({
        'any.required': 'stock_actual es obligatorio.',
        'number.min': 'stock_actual no puede ser negativo.',
    }),
    stock_minimo: Joi.number().integer().min(0).required().messages({
        'any.required': 'stock_minimo es obligatorio.',
        'number.min': 'stock_minimo no puede ser negativo.',
    }),
    fk_cod_cats: Joi.array().items(Joi.number().integer()).min(1).required().messages({
        'any.required': 'Debes asociar al menos una categoría.',
        'array.min': 'Debes asociar al menos una categoría.',
        'array.base': 'fk_cod_cats debe ser un array de IDs de categorías.',
    }),
});

const updateProductSchema = Joi.object({
    nom_prod: Joi.string().max(100).messages({
        'string.max': 'nom_prod no debe exceder 100 caracteres.',
    }),
    descrip_prod: Joi.string().allow('', null),
    precio_unitario: Joi.number().min(0).messages({
        'number.min': 'El precio_unitario no puede ser negativo.',
    }),
    descuento: Joi.number().min(0).max(100).messages({
        'number.min': 'descuento no puede ser negativo.',
        'number.max': 'descuento no puede exceder 100.',
    }),
    codigo_barras: Joi.string().pattern(/^[0-9]+$/).allow('', null).max(50).messages({
        'string.pattern.base': 'El código de barras solo puede contener números.',
        'string.max': 'codigo_barras no debe exceder 50 caracteres.',
    }),
    fechaven_prod: Joi.date().iso().allow(null).min('now').messages({
        'date.format': 'fechaven_prod debe ser una fecha válida (ISO 8601).',
        'date.min': 'La fecha de vencimiento no puede ser anterior a hoy.',
    }),
    fk_cod_cats: Joi.array().items(Joi.number().integer()).messages({
        'array.base': 'fk_cod_cats debe ser un array de IDs de categorías.',
    }),
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
