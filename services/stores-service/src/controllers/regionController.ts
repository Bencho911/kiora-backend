import { Request, Response, NextFunction } from 'express';
import repo from '../repositories/regionRepository';
import logger from '../config/logger';

async function listRegiones(req: Request, res: Response, next: NextFunction) {
    try {
        const regiones = await repo.findAll();
        res.json({ data: regiones, total: regiones.length });
    } catch (err) {
        next(err);
    }
}

async function getRegion(req: Request, res: Response, next: NextFunction) {
    try {
        const region = await repo.findById(Number((req.params.id as string)));
        if (!region) return res.status(404).json({ error: 'Regional no encontrada', code: 'NOT_FOUND' });
        res.json({ data: region });
    } catch (err) {
        next(err);
    }
}

async function createRegion(req: Request, res: Response, next: NextFunction) {
    try {
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es requerido', code: 'VALIDATION_ERROR' });
        
        const region = await repo.create({ nombre });
        logger.info('Regional creada', { id: region.id, nombre: region.nombre });
        res.status(201).json({ data: region });
    } catch (err: unknown) {
        if ((err as any).code === '23505') {
            return res.status(409).json({ error: 'Ya existe una regional con ese nombre', code: 'DUPLICATE' });
        }
        next(err);
    }
}

async function updateRegion(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number((req.params.id as string));
        const region = await repo.update(id, req.body);
        if (!region) return res.status(404).json({ error: 'Regional no encontrada', code: 'NOT_FOUND' });
        logger.info('Regional actualizada', { id: region.id });
        res.json({ data: region });
    } catch (err) {
        next(err);
    }
}

async function deleteRegion(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number((req.params.id as string));
        const region = await repo.remove(id);
        if (!region) return res.status(404).json({ error: 'Regional no encontrada', code: 'NOT_FOUND' });
        logger.info('Regional eliminada', { id });
        res.json({ message: 'Regional eliminada con éxito' });
    } catch (err: unknown) {
        if ((err as any).code === '23503') { // Foreign key constraint violation
            return res.status(409).json({ error: 'No se puede eliminar la regional porque tiene ciudades asociadas.', code: 'FK_VIOLATION' });
        }
        next(err);
    }
}

export default { listRegiones, getRegion, createRegion, updateRegion, deleteRegion };
