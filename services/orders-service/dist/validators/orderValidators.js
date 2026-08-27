"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatusSchema = exports.createOrderSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const orderItemSchema = joi_1.default.object({
    cod_prod: joi_1.default.number().integer().required().messages({
        'any.required': 'Cada item requiere cod_prod.',
    }),
    cantidad: joi_1.default.number().integer().greater(0).required().messages({
        'any.required': 'Cada item requiere cantidad.',
        'number.greater': 'cantidad debe ser mayor a 0.',
    }),
    precio_unit: joi_1.default.number().min(0).required().messages({
        'any.required': 'Cada item requiere precio_unit.',
        'number.min': 'precio_unit no puede ser negativo.',
    }),
    nom_prod: joi_1.default.string().allow('', null).optional(),
    url_imagen: joi_1.default.string().allow('', null).optional(),
    stock_actual: joi_1.default.number().optional(),
});
exports.createOrderSchema = joi_1.default.object({
    id_usu: joi_1.default.number().integer().optional(),
    metodopago_usu: joi_1.default.string().max(50).allow('', null).optional(),
    descuento_global: joi_1.default.number().min(0).max(100).optional(),
    items: joi_1.default.array().items(orderItemSchema).min(1).required().messages({
        'any.required': 'items es obligatorio.',
        'array.min': 'items debe contener al menos un producto.',
    }),
});
exports.updateOrderStatusSchema = joi_1.default.object({
    estado: joi_1.default.string().valid('pendiente', 'completada', 'cancelada', 'reembolsada').required().messages({
        'any.required': 'estado es obligatorio.',
        'any.only': "estado debe ser uno de: pendiente, completada, cancelada, reembolsada.",
    }),
});
