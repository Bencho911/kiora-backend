import { Request, Response, NextFunction } from 'express';
import repo from '../repositories/ciudadRepository';
import logger from '../config/logger';

async function listCiudades(req: Request, res: Response, next: NextFunction) {
    try {
        const regional_id = req.query.regional_id ? Number(req.query.regional_id) : undefined;
        const ciudades = await repo.findAll({ regional_id });
        res.json({ data: ciudades, total: ciudades.length });
    } catch (err) {
        next(err);
    }
}

async function getCiudad(req: Request, res: Response, next: NextFunction) {
    try {
        const ciudad = await repo.findById(Number((req.params.id as string)));
        if (!ciudad) return res.status(404).json({ error: 'Ciudad no encontrada', code: 'NOT_FOUND' });
        res.json({ data: ciudad });
    } catch (err) {
        next(err);
    }
}

async function createCiudad(req: Request, res: Response, next: NextFunction) {
    try {
        const { nombre, fk_regional_id } = req.body;
        if (!nombre || !fk_regional_id) return res.status(400).json({ error: 'El nombre y la regional son requeridos', code: 'VALIDATION_ERROR' });
        
        const ciudad = await repo.create({ nombre, fk_regional_id });
        logger.info('Ciudad creada', { id: ciudad.id, nombre: ciudad.nombre, regional: ciudad.fk_regional_id });
        res.status(201).json({ data: ciudad });
    } catch (err: unknown) {
        if ((err as any).code === '23505') {
            return res.status(409).json({ error: 'Ya existe una ciudad con ese nombre en esta regional', code: 'DUPLICATE' });
        }
        next(err);
    }
}

async function updateCiudad(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number((req.params.id as string));
        const ciudad = await repo.update(id, req.body);
        if (!ciudad) return res.status(404).json({ error: 'Ciudad no encontrada', code: 'NOT_FOUND' });
        logger.info('Ciudad actualizada', { id: ciudad.id });
        res.json({ data: ciudad });
    } catch (err) {
        next(err);
    }
}

async function deleteCiudad(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number((req.params.id as string));
        const ciudad = await repo.remove(id);
        if (!ciudad) return res.status(404).json({ error: 'Ciudad no encontrada', code: 'NOT_FOUND' });
        logger.info('Ciudad eliminada', { id });
        res.json({ message: 'Ciudad eliminada con éxito' });
    } catch (err: unknown) {
        if ((err as any).code === '23503') { // Foreign key constraint violation
            return res.status(409).json({ error: 'No se puede eliminar la ciudad porque tiene centros de operación asociados.', code: 'FK_VIOLATION' });
        }
        next(err);
    }
}

export default { listCiudades, getCiudad, createCiudad, updateCiudad, deleteCiudad };
