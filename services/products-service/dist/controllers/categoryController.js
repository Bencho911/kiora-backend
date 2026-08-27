'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategoryById = exports.getCategories = void 0;
const categoryRepository = __importStar(require("../repositories/categoryRepository"));
const parsePagination_1 = __importDefault(require("../utils/parsePagination"));
const logger_1 = __importDefault(require("../config/logger"));
const getCategories = async (req, res, next) => {
    try {
        const { page, limit, offset } = (0, parsePagination_1.default)(req.query, { defaultLimit: 100 });
        const [rows, count] = await Promise.all([
            categoryRepository.findAll({ limit, offset }),
            categoryRepository.countAll(),
        ]);
        res.status(200).json({
            data: rows.rows,
            pagination: {
                total: parseInt(count.rows[0].count, 10),
                page,
                limit,
                totalPages: Math.ceil(count.rows[0].count / limit),
            }
        });
    }
    catch (error) {
        logger_1.default.error('Error al obtener categorías', { error: error.message });
        next(error);
    }
};
exports.getCategories = getCategories;
const getCategoryById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await categoryRepository.findById(Number(id));
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Categoría no encontrada.' });
            return;
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('Error al obtener categoría', { error: error.message });
        next(error);
    }
};
exports.getCategoryById = getCategoryById;
const createCategory = async (req, res, next) => {
    const { nom_cat, descrip_cat } = req.body;
    try {
        const result = await categoryRepository.create({ nom_cat, descrip_cat });
        logger_1.default.info('Categoría creada', { cod_cat: result.rows[0].cod_cat });
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('Error al crear categoría', { error: error.message });
        next(error);
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await categoryRepository.update(Number(id), req.body);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Categoría no encontrada o ningún campo válido enviado.' });
            return;
        }
        logger_1.default.info('Categoría actualizada', { cod_cat: id });
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('Error al actualizar categoría', { error: error.message });
        next(error);
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await categoryRepository.remove(Number(id));
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Categoría no encontrada.' });
            return;
        }
        logger_1.default.info('Categoría eliminada', { cod_cat: id });
        res.status(200).json({ message: 'Categoría eliminada exitosamente.' });
    }
    catch (error) {
        logger_1.default.error('Error al eliminar categoría', { error: error.message });
        next(error);
    }
};
exports.deleteCategory = deleteCategory;
