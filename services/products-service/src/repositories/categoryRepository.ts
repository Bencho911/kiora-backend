import db from '../config/db';

export const findAll = ({ limit = 100, offset = 0 } = {}) =>
    db.query('SELECT * FROM Categoria WHERE activo = true ORDER BY cod_cat LIMIT $1 OFFSET $2', [limit, offset]);

export const countAll = () => db.query('SELECT COUNT(*) FROM Categoria WHERE activo = true');

export const findById = (cod_cat: number) =>
    db.query('SELECT * FROM Categoria WHERE cod_cat = $1 AND activo = true', [cod_cat]);

export const create = ({ nom_cat, descrip_cat }: { nom_cat: string; descrip_cat?: string }) =>
    db.query(
        'INSERT INTO Categoria (nom_cat, descrip_cat) VALUES ($1, $2) RETURNING *',
        [nom_cat, descrip_cat || null]
    );

export const update = (cod_cat: number, fields: Record<string, any>) => {
    const allowed = ['nom_cat', 'descrip_cat'];
    const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
    if (entries.length === 0) return Promise.resolve({ rows: [] });
    const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
    return db.query(
        `UPDATE Categoria SET ${setClauses}
         WHERE cod_cat = $${entries.length + 1} AND activo = true
         RETURNING *`,
        [...entries.map(([, val]) => val), cod_cat]
    );
};

export const remove = (cod_cat: number) =>
    db.query('UPDATE Categoria SET activo = false WHERE cod_cat = $1 AND activo = true RETURNING cod_cat', [cod_cat]);
