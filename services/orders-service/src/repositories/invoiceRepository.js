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
 * @param {object} [client=db] — Cliente PG de una transacción activa (opcional)
 */
const create = ({ fk_id_vent, id_usu, cantidad_vent, precio_prod, montototal_vent }, client = db) =>
    client.query(
        `INSERT INTO Factura (fk_id_vent, id_usu, cantidad_vent, precio_prod, montototal_vent)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [fk_id_vent, id_usu, cantidad_vent, precio_prod, montototal_vent]
    );

/**
 * Actualiza los campos de facturación electrónica (Factus/DIAN).
 * @param {number} invoiceId — ID de la factura local
 * @param {{ factus_invoice_number, factus_cufe, factus_public_url, factus_qr_link, factus_status }} fields
 */
const updateFactusFields = (invoiceId, fields, client = db) =>
    client.query(
        `UPDATE Factura
         SET factus_invoice_number = COALESCE($2, factus_invoice_number),
             factus_cufe           = COALESCE($3, factus_cufe),
             factus_public_url     = COALESCE($4, factus_public_url),
             factus_qr_link        = COALESCE($5, factus_qr_link),
             factus_status         = COALESCE($6, factus_status)
         WHERE id = $1
         RETURNING *`,
        [
            invoiceId,
            fields.factus_invoice_number || null,
            fields.factus_cufe || null,
            fields.factus_public_url || null,
            fields.factus_qr_link || null,
            fields.factus_status || null,
        ]
    );

/**
 * Busca la factura de una venta incluyendo los campos de Factus.
 * @param {number} fk_id_vent — ID de la venta
 */
const findByVentaWithFactus = (fk_id_vent) =>
    db.query(
        `SELECT id, fk_id_vent, factus_invoice_number, factus_cufe,
                factus_public_url, factus_qr_link, factus_status
         FROM Factura
         WHERE fk_id_vent = $1`,
        [fk_id_vent]
    );

module.exports = {
    findAll, countAll, findById, findByVenta, create,
    updateFactusFields, findByVentaWithFactus,
};
