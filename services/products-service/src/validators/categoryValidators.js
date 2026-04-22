'use strict';

const Joi = require('joi');

const createCategorySchema = Joi.object({
    nom_cat: Joi.string().max(40).required().messages({
        'any.required': 'nom_cat es obligatorio.',
        'string.max': 'nom_cat no debe exceder 40 caracteres.',
    }),
    descrip_cat: Joi.string().allow('', null).optional(),
});

const updateCategorySchema = Joi.object({
    nom_cat: Joi.string().max(40).messages({
        'string.max': 'nom_cat no debe exceder 40 caracteres.',
    }),
    descrip_cat: Joi.string().allow('', null),
}).min(1).messages({
    'object.min': 'Debes enviar al menos un campo para actualizar.',
});

module.exports = {
    createCategorySchema,
    updateCategorySchema,
};
