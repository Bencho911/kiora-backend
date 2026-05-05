'use strict';

const Joi = require('joi');

const orderItemSchema = Joi.object({
    cod_prod: Joi.number().integer().required().messages({
        'any.required': 'Cada item requiere cod_prod.',
    }),
    cantidad: Joi.number().integer().greater(0).required().messages({
        'any.required': 'Cada item requiere cantidad.',
        'number.greater': 'cantidad debe ser mayor a 0.',
    }),
    precio_unit: Joi.number().min(0).required().messages({
        'any.required': 'Cada item requiere precio_unit.',
        'number.min': 'precio_unit no puede ser negativo.',
    }),
});

const createOrderSchema = Joi.object({
    id_usu: Joi.number().integer().optional(),
    metodopago_usu: Joi.string().max(50).allow('', null).optional(),
    items: Joi.array().items(orderItemSchema).min(1).required().messages({
        'any.required': 'items es obligatorio.',
        'array.min': 'items debe contener al menos un producto.',
    }),
});

const updateOrderStatusSchema = Joi.object({
    estado: Joi.string().valid('pendiente', 'completada', 'cancelada', 'reembolsada').required().messages({
        'any.required': 'estado es obligatorio.',
        'any.only': "estado debe ser uno de: pendiente, completada, cancelada, reembolsada.",
    }),
});

module.exports = {
    createOrderSchema,
    updateOrderStatusSchema,
};
