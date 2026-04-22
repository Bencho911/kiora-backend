'use strict';

const db = require('../config/db');

/**
 * categoryRepository
 * Responsabilidad única: todas las operaciones de acceso a datos
 * de la tabla Categoria.
 */

const findAll = ({ limit = 100, offset = 0 } = {}) =>
    db.query('SELECT * FROM Categoria WHERE activo = true ORDER BY cod_cat LIMIT $1 OFFSET $2', [limit, offset]);

const countAll = () => db.query('SELECT COUNT(*) FROM Categoria WHERE activo = true');

const findById = (cod_cat) =>
    db.query('SELECT * FROM Categoria WHERE cod_cat = $1', [cod_cat]);

/**
 * @param {{ nom_cat, descrip_cat }} fields
 */
const create = ({ nom_cat, descrip_cat }) =>
    db.query(
        'INSERT INTO Categoria (nom_cat, descrip_cat) VALUES ($1, $2) RETURNING *',
        [nom_cat, descrip_cat || null]
    );

/**
 * @param {number} cod_cat
 * @param {object} fields
 */
const update = (cod_cat, fields) => {
    const allowed = ['nom_cat', 'descrip_cat'];
    const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
    if (entries.length === 0) return Promise.resolve({ rows: [] });
    const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
    return db.query(
        `UPDATE Categoria SET ${setClauses}
         WHERE cod_cat = $${entries.length + 1}
         RETURNING *`,
        [...entries.map(([, val]) => val), cod_cat]
    );
};

const remove = (cod_cat) =>
    db.query('UPDATE Categoria SET activo = false WHERE cod_cat = $1 AND activo = true RETURNING cod_cat', [cod_cat]);

module.exports = { findAll, countAll, findById, create, update, remove };
