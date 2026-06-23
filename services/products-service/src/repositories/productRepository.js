'use strict';

const db = require('../config/db');

/**
 * productRepository
 * Responsabilidad única: todas las operaciones de acceso a datos
 * de las tablas Producto y Categoria.
 */

/**
 * Devuelve productos con nombre de categoría incluido (paginado).
 * @param {{ limit, offset }} opts
 */
const findAll = ({ limit = 20, offset = 0 } = {}) =>
    db.query(
        `SELECT p.cod_prod, p.nom_prod, p.descrip_prod, p.precio_unitario,
                p.fechaven_prod, p.fk_cod_cats,
                p.stock_actual, p.stock_minimo, p.url_imagen, p.descuento, p.codigo_barras
         FROM Producto p
         WHERE p.activo = true
         ORDER BY p.cod_prod
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

/** Cuenta total de productos para paginación */
const countAll = () => db.query('SELECT COUNT(*) FROM Producto WHERE activo = true');

/**
 * Busca un producto por su PK.
 * @param {number} cod_prod
 */
const findById = (cod_prod) =>
    db.query(
        `SELECT p.cod_prod, p.nom_prod, p.descrip_prod, p.precio_unitario,
                p.fechaven_prod, p.fk_cod_cats,
                p.stock_actual, p.stock_minimo, p.url_imagen, p.descuento, p.codigo_barras
         FROM Producto p
         WHERE p.cod_prod = $1`,
        [cod_prod]
    );

/**
 * Busca un producto por su nombre (exacto).
 * @param {string} nom_prod
 */
const findByName = (nom_prod) =>
    db.query(
        `SELECT cod_prod, nom_prod
         FROM Producto
         WHERE LOWER(nom_prod) = LOWER($1) AND activo = true`,
        [nom_prod]
    );

/**
 * Busca un producto por su código de barras.
 * @param {string} codigo_barras
 */
const findByBarcode = (codigo_barras) =>
    db.query(
        `SELECT cod_prod, codigo_barras
         FROM Producto
         WHERE codigo_barras = $1 AND activo = true`,
        [codigo_barras]
    );

/**
 * Inserta un nuevo producto.
 * @param {{ nom_prod, descrip_prod, precio_unitario, descuento, fechaven_prod, fk_cod_cats, stock_actual, stock_minimo, url_imagen, codigo_barras }} fields
 */
const create = ({ nom_prod, descrip_prod, precio_unitario, descuento, fechaven_prod, fk_cod_cats, stock_actual, stock_minimo, url_imagen, codigo_barras }) =>
    db.query(
        `INSERT INTO Producto (nom_prod, descrip_prod, precio_unitario, descuento, fechaven_prod, fk_cod_cats, stock_actual, stock_minimo, url_imagen, codigo_barras)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [nom_prod, descrip_prod || null, precio_unitario, descuento ?? 0, fechaven_prod || null, fk_cod_cats || [], stock_actual ?? 0, stock_minimo ?? 0, url_imagen || null, codigo_barras || null]
    );

/**
 * Actualiza los campos presentes en el objeto fields.
 * @param {number} cod_prod
 * @param {object} fields
 */
const update = (cod_prod, fields) => {
    const allowed = ['nom_prod', 'descrip_prod', 'precio_unitario', 'descuento', 'fechaven_prod', 'fk_cod_cats', 'stock_actual', 'stock_minimo', 'url_imagen', 'codigo_barras'];
    const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
    if (entries.length === 0) return Promise.resolve({ rows: [] });
    const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
    return db.query(
        `UPDATE Producto SET ${setClauses}
         WHERE cod_prod = $${entries.length + 1}
         RETURNING *`,
        [...entries.map(([, val]) => val), cod_prod]
    );
};

/**
 * Actualiza el stock de forma atómica (suma o resta).
 * @param {number} cod_prod — PK del producto
 * @param {number} cantidad — positivo para sumar, negativo para restar
 */
const updateStock = (cod_prod, cantidad) =>
    db.query(
        `UPDATE Producto
         SET stock_actual = stock_actual + $1
         WHERE cod_prod = $2
         RETURNING *`,
        [cantidad, cod_prod]
    );

/**
 * Elimina un producto por su PK.
 * @param {number} cod_prod
 */
const remove = (cod_prod) =>
    db.query(
        'UPDATE Producto SET activo = false WHERE cod_prod = $1 AND activo = true RETURNING cod_prod',
        [cod_prod]
    );

/**
 * Devuelve productos con stock_actual <= stock_minimo.
 */
const findLowStock = () =>
    db.query(
        `SELECT p.cod_prod, p.nom_prod, p.stock_actual, p.stock_minimo, p.fk_cod_cats
         FROM Producto p
         WHERE p.stock_actual <= p.stock_minimo AND p.activo = true
         ORDER BY p.cod_prod`
    );

module.exports = { findAll, countAll, findById, findByName, findByBarcode, create, update, updateStock, remove, findLowStock };
