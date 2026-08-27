'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const joi_1 = __importDefault(require("joi"));
const createSupplierSchema = joi_1.default.object({
    nom_prov: joi_1.default.string().max(100).required().messages({
        'any.required': 'nom_prov es obligatorio.',
        'string.max': 'nom_prov no debe exceder 100 caracteres.',
    }),
    id_prov: joi_1.default.string().max(50).allow('', null).optional(),
    tel_prov: joi_1.default.string().max(20).required().messages({
        'any.required': 'tel_prov es obligatorio.'
    }),
    tipoid_prov: joi_1.default.string().max(20).allow('', null).optional(),
    correo_prov: joi_1.default.string().max(100).required().messages({
        'any.required': 'correo_prov es obligatorio.'
    }),
    dir_prov: joi_1.default.string().max(200).allow('', null).optional(),
});
const updateSupplierSchema = joi_1.default.object({
    nom_prov: joi_1.default.string().max(100).messages({
        'string.max': 'nom_prov no debe exceder 100 caracteres.',
    }),
    id_prov: joi_1.default.string().max(50).allow('', null),
    tel_prov: joi_1.default.string().max(20).allow('', null),
    tipoid_prov: joi_1.default.string().max(20).allow('', null),
    correo_prov: joi_1.default.string().max(100).allow('', null),
    dir_prov: joi_1.default.string().max(200).allow('', null),
}).min(1).messages({
    'object.min': 'Debes enviar al menos un campo para actualizar.',
});
const createMovementSchema = joi_1.default.object({
    tipo_mov: joi_1.default.string().valid('entrada', 'salida', 'ajuste').required().messages({
        'any.required': 'tipo_mov es obligatorio.',
        'any.only': "tipo_mov debe ser 'entrada', 'salida' o 'ajuste'.",
    }),
    cantidad: joi_1.default.number().integer().required().messages({
        'any.required': 'cantidad es obligatorio.',
        'number.integer': 'cantidad debe ser un número entero.',
    }),
    cod_prod: joi_1.default.number().integer().required().messages({
        'any.required': 'cod_prod es obligatorio.',
    }),
    fecha_mov: joi_1.default.date().iso().allow(null).optional(),
    fk_cod_prov: joi_1.default.number().integer().allow(null).optional(),
    fk_id_vent: joi_1.default.number().integer().allow(null).optional(),
    fecha_vencimiento: joi_1.default.date().iso().allow(null).optional(),
    desc_mov: joi_1.default.string().max(255).required().messages({
        'any.required': 'La justificación (desc_mov) es obligatoria.',
        'string.empty': 'La justificación no puede estar vacía.',
    }),
});
const upsertSuministraSchema = joi_1.default.object({
    fk_cod_prov: joi_1.default.number().integer().required().messages({
        'any.required': 'fk_cod_prov es obligatorio.',
    }),
    cod_prod: joi_1.default.number().integer().required().messages({
        'any.required': 'cod_prod es obligatorio.',
    }),
    stock: joi_1.default.number().integer().min(0).default(0).messages({
        'number.min': 'stock no puede ser negativo.',
    }),
    stock_minimo: joi_1.default.number().integer().min(0).default(0).messages({
        'number.min': 'stock_minimo no puede ser negativo.',
    }),
});
exports.default = {
    createSupplierSchema,
    updateSupplierSchema,
    createMovementSchema,
    upsertSuministraSchema,
};
