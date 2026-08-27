import * as repo from '../repositories/incidentsRepository';
import logger from '../config/logger';
import { Request, Response } from 'express';

export const getAll = async (req: Request, res: Response) => {
    try {
        const { rows } = await repo.findAll();
        res.status(200).json(rows);
    } catch (e) {
        logger.error('Error fetching incidents', e);
        res.status(500).json({ error: 'Error obteniendo reportes' });
    }
};

export const createIncident = async (req: Request, res: Response): Promise<any> => {
    try {
        const payload = req.body;
        if (!payload.fk_id_usu) return res.status(400).json({ error: 'fk_id_usu es requerido' });

        const { rows } = await repo.create(payload);
        res.status(201).json(rows[0]);
    } catch (e) {
        logger.error('Error creando incidence', e);
        res.status(500).json({ error: 'Error creando el reporte' });
    }
};

export const updateIncidentState = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { estado } = req.body;
        if (!estado) return res.status(400).json({ error: 'campo estado es requerido' });

        const { rows } = await repo.updateStatus(Number(id), estado);
        if (rows.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' });
        res.status(200).json(rows[0]);
    } catch (e) {
        logger.error('Error actualizando incidence', e);
        res.status(500).json({ error: 'Error actualizando el reporte' });
    }
};

export const deleteIncident = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { rows } = await repo.remove(Number(id));
        if (rows.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' });
        res.status(200).json({ message: 'Reporte eliminado correctamente', incidente: rows[0] });
    } catch (e) {
        logger.error('Error eliminando incidente', e);
        res.status(500).json({ error: 'Error eliminando el reporte' });
    }
};
