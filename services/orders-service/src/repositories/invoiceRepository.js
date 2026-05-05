'use strict';

const db = require('../config/db');

/**
 * invoiceRepository
 * Responsabilidad única: acceso a datos de Factura.
 */

const findAll = ({ limit = 20, offset = 0 } = {}) =>
    db.query(
        `SELECT f.*, v.fecha_vent, v.estado
         FROM Factura f
         JOIN Ventas v ON v.id_vent = f.fk_id_vent
         ORDER BY f.emitida_en DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

const countAll = () => db.query('SELECT COUNT(*) FROM Factura');

const findById = (id) =>
    db.query(
        `SELECT f.*, v.fecha_vent, v.estado, v.metodopago_usu
         FROM Factura f
         JOIN Ventas v ON v.id_vent = f.fk_id_vent
         WHERE f.id = $1`,
        [id]
    );

const findByVenta = (fk_id_vent) =>
    db.query('SELECT * FROM Factura WHERE fk_id_vent = $1', [fk_id_vent]);

/**
 * Emite una factura para una venta existente.
 * @param {{ fk_id_vent, id_usu, cantidad_vent, precio_prod, montototal_vent }} data
 */
const create = ({ fk_id_vent, id_usu, cantidad_vent, precio_prod, montototal_vent }) =>
    db.query(
        `INSERT INTO Factura (fk_id_vent, id_usu, cantidad_vent, precio_prod, montototal_vent)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [fk_id_vent, id_usu, cantidad_vent, precio_prod, montototal_vent]
    );

module.exports = { findAll, countAll, findById, findByVenta, create };
