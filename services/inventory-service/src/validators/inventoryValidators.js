'use strict';

const Joi = require('joi');

const createSupplierSchema = Joi.object({
    nom_prov: Joi.string().max(100).required().messages({
        'any.required': 'nom_prov es obligatorio.',
        'string.max': 'nom_prov no debe exceder 100 caracteres.',
    }),
    id_prov: Joi.string().max(50).allow('', null).optional(),
    tel_prov: Joi.string().max(20).allow('', null).optional(),
    tipoid_prov: Joi.string().max(20).allow('', null).optional(),
    correo_prov: Joi.string().max(100).allow('', null).optional(),
    dir_prov: Joi.string().max(200).allow('', null).optional(),
});

const updateSupplierSchema = Joi.object({
    nom_prov: Joi.string().max(100).messages({
        'string.max': 'nom_prov no debe exceder 100 caracteres.',
    }),
    id_prov: Joi.string().max(50).allow('', null),
    tel_prov: Joi.string().max(20).allow('', null),
    tipoid_prov: Joi.string().max(20).allow('', null),
    correo_prov: Joi.string().max(100).allow('', null),
    dir_prov: Joi.string().max(200).allow('', null),
}).min(1).messages({
    'object.min': 'Debes enviar al menos un campo para actualizar.',
});

const createMovementSchema = Joi.object({
    tipo_mov: Joi.string().valid('entrada', 'salida', 'ajuste').required().messages({
        'any.required': 'tipo_mov es obligatorio.',
        'any.only': "tipo_mov debe ser 'entrada', 'salida' o 'ajuste'.",
    }),
    cantidad: Joi.number().integer().greater(0).required().messages({
        'any.required': 'cantidad es obligatorio.',
        'number.greater': 'cantidad debe ser mayor a 0.',
        'number.integer': 'cantidad debe ser un número entero.',
    }),
    cod_prod: Joi.number().integer().required().messages({
        'any.required': 'cod_prod es obligatorio.',
    }),
    fecha_mov: Joi.date().iso().allow(null).optional(),
    fk_cod_prov: Joi.number().integer().allow(null).optional(),
    fk_id_vent: Joi.number().integer().allow(null).optional(),
    desc_mov: Joi.string().max(255).required().messages({
        'any.required': 'La justificación (desc_mov) es obligatoria.',
        'string.empty': 'La justificación no puede estar vacía.',
    }),
});

const upsertSuministraSchema = Joi.object({
    fk_cod_prov: Joi.number().integer().required().messages({
        'any.required': 'fk_cod_prov es obligatorio.',
    }),
    cod_prod: Joi.number().integer().required().messages({
        'any.required': 'cod_prod es obligatorio.',
    }),
    stock: Joi.number().integer().min(0).default(0).messages({
        'number.min': 'stock no puede ser negativo.',
    }),
    stock_minimo: Joi.number().integer().min(0).default(0).messages({
        'number.min': 'stock_minimo no puede ser negativo.',
    }),
});

module.exports = {
    createSupplierSchema,
    updateSupplierSchema,
    createMovementSchema,
    upsertSuministraSchema,
};
