import db from '../config/db';
import { Regional } from '../models/types';

async function findAll(): Promise<Regional[]> {
    const { rows } = await db.query('SELECT * FROM Regional ORDER BY id ASC');
    return rows;
}

async function findById(id: number): Promise<Regional | null> {
    const { rows } = await db.query('SELECT * FROM Regional WHERE id = $1', [id]);
    return rows[0] || null;
}

async function create({ nombre }: { nombre: string }): Promise<Regional> {
    const { rows } = await db.query(
        'INSERT INTO Regional (nombre) VALUES ($1) RETURNING *',
        [nombre]
    );
    return rows[0];
}

async function update(id: number, { nombre }: { nombre?: string }): Promise<Regional | null> {
    const { rows } = await db.query(
        'UPDATE Regional SET nombre = COALESCE($1, nombre) WHERE id = $2 RETURNING *',
        [nombre, id]
    );
    return rows[0] || null;
}

async function remove(id: number): Promise<number | null> {
    const { rows } = await db.query('DELETE FROM Regional WHERE id = $1 RETURNING id', [id]);
    return rows[0]?.id || null;
}

export default { findAll, findById, create, update, remove };
