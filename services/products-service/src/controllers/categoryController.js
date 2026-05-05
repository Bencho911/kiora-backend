'use strict';

const categoryRepository = require('../repositories/categoryRepository');
const parsePagination = require('../utils/parsePagination');
const logger = require('../config/logger');

/**
 * categoryController
 * Orquesta la lógica de negocio del catálogo de categorías.
 */

// GET /api/categories
const getCategories = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 100 });
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
    } catch (error) {
        logger.error('Error al obtener categorías', { error: error.message });
        next(error);
    }
};

// GET /api/categories/:id
const getCategoryById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await categoryRepository.findById(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al obtener categoría', { error: error.message });
        next(error);
    }
};

// POST /api/categories
const createCategory = async (req, res, next) => {
    const { nom_cat, descrip_cat } = req.body;
    try {
        const result = await categoryRepository.create({ nom_cat, descrip_cat });
        logger.info('Categoría creada', { cod_cat: result.rows[0].cod_cat });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al crear categoría', { error: error.message });
        next(error);
    }
};

// PUT /api/categories/:id
const updateCategory = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await categoryRepository.update(id, req.body);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada o ningún campo válido enviado.' });
        }
        logger.info('Categoría actualizada', { cod_cat: id });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al actualizar categoría', { error: error.message });
        next(error);
    }
};

// DELETE /api/categories/:id
const deleteCategory = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await categoryRepository.remove(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }
        logger.info('Categoría eliminada', { cod_cat: id });
        res.status(200).json({ message: 'Categoría eliminada exitosamente.' });
    } catch (error) {
        logger.error('Error al eliminar categoría', { error: error.message });
        next(error);
    }
};

module.exports = { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
