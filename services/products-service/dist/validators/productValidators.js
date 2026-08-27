"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStockSchema = exports.updateProductSchema = exports.createProductSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createProductSchema = joi_1.default.object({
    nom_prod: joi_1.default.string().max(100).required().messages({
        'any.required': 'nom_prod es obligatorio.',
        'string.max': 'nom_prod no debe exceder 100 caracteres.',
    }),
    descrip_prod: joi_1.default.string().allow('', null).optional(),
    precio_unitario: joi_1.default.number().min(0).required().messages({
        'any.required': 'precio_unitario es obligatorio.',
        'number.min': 'El precio_unitario no puede ser negativo.',
    }),
    descuento: joi_1.default.number().min(0).max(100).default(0).messages({
        'number.min': 'descuento no puede ser negativo.',
        'number.max': 'descuento no puede exceder 100.',
    }),
    codigo_barras: joi_1.default.string().pattern(/^[0-9]+$/).allow('', null).max(50).optional().messages({
        'string.pattern.base': 'El código de barras solo puede contener números.',
        'string.max': 'codigo_barras no debe exceder 50 caracteres.',
    }),
    fechaven_prod: joi_1.default.date().iso().allow(null).optional().min('now').messages({
        'date.format': 'fechaven_prod debe ser una fecha válida (ISO 8601).',
        'date.min': 'La fecha de vencimiento no puede ser anterior a hoy.',
    }),
    stock_actual: joi_1.default.number().integer().min(0).required().messages({
        'any.required': 'stock_actual es obligatorio.',
        'number.min': 'stock_actual no puede ser negativo.',
    }),
    stock_minimo: joi_1.default.number().integer().min(0).required().messages({
        'any.required': 'stock_minimo es obligatorio.',
        'number.min': 'stock_minimo no puede ser negativo.',
    }),
    fk_cod_cats: joi_1.default.array().items(joi_1.default.number().integer()).min(1).required().messages({
        'any.required': 'Debes asociar al menos una categoría.',
        'array.min': 'Debes asociar al menos una categoría.',
        'array.base': 'fk_cod_cats debe ser un array de IDs de categorías.',
    }),
});
exports.updateProductSchema = joi_1.default.object({
    nom_prod: joi_1.default.string().max(100).messages({
        'string.max': 'nom_prod no debe exceder 100 caracteres.',
    }),
    descrip_prod: joi_1.default.string().allow('', null),
    precio_unitario: joi_1.default.number().min(0).messages({
        'number.min': 'El precio_unitario no puede ser negativo.',
    }),
    descuento: joi_1.default.number().min(0).max(100).messages({
        'number.min': 'descuento no puede ser negativo.',
        'number.max': 'descuento no puede exceder 100.',
    }),
    codigo_barras: joi_1.default.string().pattern(/^[0-9]+$/).allow('', null).max(50).messages({
        'string.pattern.base': 'El código de barras solo puede contener números.',
        'string.max': 'codigo_barras no debe exceder 50 caracteres.',
    }),
    fechaven_prod: joi_1.default.date().iso().allow(null).min('now').messages({
        'date.format': 'fechaven_prod debe ser una fecha válida (ISO 8601).',
        'date.min': 'La fecha de vencimiento no puede ser anterior a hoy.',
    }),
    fk_cod_cats: joi_1.default.array().items(joi_1.default.number().integer()).messages({
        'array.base': 'fk_cod_cats debe ser un array de IDs de categorías.',
    }),
    stock_actual: joi_1.default.number().integer().min(0).messages({
        'number.min': 'stock_actual no puede ser negativo.',
    }),
    stock_minimo: joi_1.default.number().integer().min(0).messages({
        'number.min': 'stock_minimo no puede ser negativo.',
    }),
}).min(1).messages({
    'object.min': 'Debes enviar al menos un campo para actualizar.',
});
exports.updateStockSchema = joi_1.default.object({
    cantidad: joi_1.default.number().integer().required().messages({
        'any.required': 'cantidad es obligatorio.',
        'number.base': 'cantidad debe ser un número entero.',
        'number.integer': 'cantidad debe ser un número entero.',
    }),
});
