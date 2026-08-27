import db from '../config/db';
import { Cliente, ReporteFallo } from '../models/types';

export const findAll = async () => {
    return db.query('SELECT * FROM ReporteFallo ORDER BY fecha_rep DESC');
};

export const findById = async (id: number) => {
    return db.query('SELECT * FROM ReporteFallo WHERE id_rep = $1', [id]);
};

export const create = async (data: Partial<ReporteFallo>) => {
    const { descripcion, prioridad, estado, fk_id_usu, cod_prod, observaciones_tecnicas, titulo } = data;
    return db.query(
        'INSERT INTO ReporteFallo (descripcion, prioridad, estado, fk_id_usu, cod_prod, observaciones_tecnicas, titulo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', 
        [descripcion, prioridad || 'media', estado || 'pendiente', fk_id_usu, cod_prod || null, observaciones_tecnicas || null, titulo || null]
    );
};

export const updateStatus = async (id: number, estado: string) => {
    return db.query('UPDATE ReporteFallo SET estado = $1 WHERE id_rep = $2 RETURNING *', [estado, id]);
};

export const remove = async (id: number) => {
    return db.query('DELETE FROM ReporteFallo WHERE id_rep = $1 RETURNING *', [id]);
};
