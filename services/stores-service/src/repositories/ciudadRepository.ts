import db from '../config/db';
import { Ciudad } from '../models/types';

async function findAll({ regional_id }: { regional_id?: number } = {}): Promise<Ciudad[]> {
    let query = `
        SELECT c.*, r.nombre AS regional_nombre 
        FROM Ciudad c
        JOIN Regional r ON c.fk_regional_id = r.id
    `;
    const params: any[] = [];
    if (regional_id) {
        query += ' WHERE c.fk_regional_id = $1';
        params.push(regional_id);
    }
    query += ' ORDER BY c.id ASC';
    
    const { rows } = await db.query(query, params);
    return rows;
}

async function findById(id: number): Promise<Ciudad | null> {
    const { rows } = await db.query(`
        SELECT c.*, r.nombre AS regional_nombre 
        FROM Ciudad c
        JOIN Regional r ON c.fk_regional_id = r.id
        WHERE c.id = $1
    `, [id]);
    return rows[0] || null;
}

async function create({ nombre, fk_regional_id }: { nombre: string; fk_regional_id: number }): Promise<Ciudad> {
    const { rows } = await db.query(
        'INSERT INTO Ciudad (nombre, fk_regional_id) VALUES ($1, $2) RETURNING *',
        [nombre, fk_regional_id]
    );
    return rows[0];
}

async function update(id: number, { nombre, fk_regional_id }: { nombre?: string; fk_regional_id?: number }): Promise<Ciudad | null> {
    const { rows } = await db.query(
        'UPDATE Ciudad SET nombre = COALESCE($1, nombre), fk_regional_id = COALESCE($2, fk_regional_id) WHERE id = $3 RETURNING *',
        [nombre, fk_regional_id, id]
    );
    return rows[0] || null;
}

async function remove(id: number): Promise<number | null> {
    const { rows } = await db.query('DELETE FROM Ciudad WHERE id = $1 RETURNING id', [id]);
    return rows[0]?.id || null;
}

export default { findAll, findById, create, update, remove };
