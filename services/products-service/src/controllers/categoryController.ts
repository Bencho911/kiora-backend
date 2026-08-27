'use strict';

import * as categoryRepository from '../repositories/categoryRepository';
import parsePagination from '../utils/parsePagination';
import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';

export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
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
    } catch (error: unknown) {
        logger.error('Error al obtener categorías', { error: (error as Error).message });
        next(error);
    }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const result = await categoryRepository.findById(Number(id));
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Categoría no encontrada.' });
            return;
        }
        res.status(200).json(result.rows[0]);
    } catch (error: unknown) {
        logger.error('Error al obtener categoría', { error: (error as Error).message });
        next(error);
    }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
    const { nom_cat, descrip_cat } = req.body;
    try {
        const result = await categoryRepository.create({ nom_cat, descrip_cat });
        logger.info('Categoría creada', { cod_cat: result.rows[0].cod_cat });
        res.status(201).json(result.rows[0]);
    } catch (error: unknown) {
        logger.error('Error al crear categoría', { error: (error as Error).message });
        next(error);
    }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const result = await categoryRepository.update(Number(id), req.body);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Categoría no encontrada o ningún campo válido enviado.' });
            return;
        }
        logger.info('Categoría actualizada', { cod_cat: id });
        res.status(200).json(result.rows[0]);
    } catch (error: unknown) {
        logger.error('Error al actualizar categoría', { error: (error as Error).message });
        next(error);
    }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const result = await categoryRepository.remove(Number(id));
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Categoría no encontrada.' });
            return;
        }
        logger.info('Categoría eliminada', { cod_cat: id });
        res.status(200).json({ message: 'Categoría eliminada exitosamente.' });
    } catch (error: unknown) {
        logger.error('Error al eliminar categoría', { error: (error as Error).message });
        next(error);
    }
};
