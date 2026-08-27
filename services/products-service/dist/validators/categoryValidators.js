"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategorySchema = exports.createCategorySchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createCategorySchema = joi_1.default.object({
    nom_cat: joi_1.default.string().max(40).required().messages({
        'any.required': 'nom_cat es obligatorio.',
        'string.max': 'nom_cat no debe exceder 40 caracteres.',
    }),
    descrip_cat: joi_1.default.string().allow('', null).optional(),
});
exports.updateCategorySchema = joi_1.default.object({
    nom_cat: joi_1.default.string().max(40).messages({
        'string.max': 'nom_cat no debe exceder 40 caracteres.',
    }),
    descrip_cat: joi_1.default.string().allow('', null),
}).min(1).messages({
    'object.min': 'Debes enviar al menos un campo para actualizar.',
});
