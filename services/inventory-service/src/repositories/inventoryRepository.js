'use strict';

const db = require('../config/db');

/* ── Proveedores ──────────────────────────────────────────────────────────── */

const findAllSuppliers = ({ limit = 20, offset = 0 } = {}) =>
    db.query(
        'SELECT * FROM Proveedor ORDER BY cod_prov LIMIT $1 OFFSET $2',
        [limit, offset]
    );

const countAllSuppliers = () =>
    db.query('SELECT COUNT(*) FROM Proveedor');

const findSupplierById = (id) =>
    db.query('SELECT * FROM Proveedor WHERE cod_prov = $1', [id]);

const createSupplier = ({ id_prov, nom_prov, tel_prov, tipoid_prov, correo_prov, dir_prov }) =>
    db.query(
        `INSERT INTO Proveedor (id_prov, nom_prov, tel_prov, tipoid_prov, correo_prov, dir_prov)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id_prov, nom_prov, tel_prov, tipoid_prov, correo_prov, dir_prov]
    );

const updateSupplier = (id, fields) => {
    const allowed = ['nom_prov', 'id_prov', 'tel_prov', 'tipoid_prov', 'correo_prov', 'dir_prov'];
    const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
    if (entries.length === 0) return Promise.resolve({ rows: [] });

    const setClause = entries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = entries.map(([, val]) => val);

    return db.query(
        `UPDATE Proveedor SET ${setClause} WHERE cod_prov = $1 RETURNING *`,
        [id, ...values]
    );
};

const removeSupplier = (id) =>
    db.query('DELETE FROM Proveedor WHERE cod_prov = $1 RETURNING *', [id]);

/* ── Movimientos (Historial) ─────────────────────────────────────────────── */

const findAllMovements = ({ cod_prod = null, limit = 20, offset = 0 } = {}) => {
    if (cod_prod) {
        return db.query(
            'SELECT * FROM Inventario WHERE cod_prod = $1 ORDER BY fecha_mov DESC, id_mov DESC LIMIT $2 OFFSET $3',
            [cod_prod, limit, offset]
        );
    }
    return db.query(
        'SELECT * FROM Inventario ORDER BY fecha_mov DESC, id_mov DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );
};

const countAllMovements = (cod_prod) =>
    cod_prod
        ? db.query('SELECT COUNT(*) FROM Inventario WHERE cod_prod = $1', [cod_prod])
        : db.query('SELECT COUNT(*) FROM Inventario');

const createMovement = ({ tipo_mov, fecha_mov, cantidad, cod_prod, fk_cod_prov, fk_id_vent, desc_mov }) =>
    db.query(
        `INSERT INTO Inventario (tipo_mov, fecha_mov, cantidad, cod_prod, fk_cod_prov, fk_id_vent, desc_mov)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (fk_id_vent, cod_prod, tipo_mov) WHERE fk_id_vent IS NOT NULL
         DO UPDATE SET cantidad = EXCLUDED.cantidad, desc_mov = EXCLUDED.desc_mov
         RETURNING *`,
        [tipo_mov, fecha_mov || new Date(), cantidad, cod_prod, fk_cod_prov || null, fk_id_vent || null, desc_mov || null]
    );

/* ── Suministra (proveedor ↔ producto + stock) ───────────────────────────── */

const findAllSuministra = ({ limit = 20, offset = 0 } = {}) =>
    db.query(
        `SELECT s.*, p.nom_prov
         FROM Suministra s
         JOIN Proveedor p ON p.cod_prov = s.fk_cod_prov
         ORDER BY s.id
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

const countAllSuministra = () =>
    db.query('SELECT COUNT(*) FROM Suministra');

const findSuministraById = (id) =>
    db.query('SELECT * FROM Suministra WHERE id = $1', [id]);

/**
 * Actualiza el stock sumando o restando un delta.
 * Si no se especifica proveedor, se intenta actualizar el primer registro encontrado para el producto.
 */
const updateStock = (cod_prod, delta, fk_cod_prov = null, fecha_vencimiento = null) => {
    let vencimientoSet = '';
    const params = [delta, cod_prod];
    let paramIndex = 3;

    if (fecha_vencimiento) {
        vencimientoSet = `, fecha_vencimiento = $${paramIndex}`;
        params.push(fecha_vencimiento);
        paramIndex++;
    }

    if (fk_cod_prov) {
        params.push(fk_cod_prov);
        return db.query(
            `UPDATE Suministra SET stock = stock + $1${vencimientoSet} WHERE cod_prod = $2 AND fk_cod_prov = $${paramIndex - 1} RETURNING *`,
            params
        );
    }
    return db.query(
        `UPDATE Suministra SET stock = stock + $1${vencimientoSet} WHERE id = (SELECT id FROM Suministra WHERE cod_prod = $2 LIMIT 1) RETURNING *`,
        params
    );
};

/**
 * Crea o actualiza (upsert) el registro proveedor-producto.
 * @param {{ fk_cod_prov, cod_prod, stock, stock_minimo }} fields
 */
const upsertSuministra = ({ fk_cod_prov, cod_prod, stock, stock_minimo }) =>
    db.query(
        `INSERT INTO Suministra (fk_cod_prov, cod_prod, stock, stock_minimo)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (fk_cod_prov, cod_prod)
         DO UPDATE SET stock = $3, stock_minimo = $4
         RETURNING *`,
        [fk_cod_prov, cod_prod, stock ?? 0, stock_minimo ?? 0]
    );

/**
 * Devuelve todos los registros donde stock < stock_minimo.
 * HU14 — detectar bajo stock.
 */
const findLowStock = () =>
    db.query(
        `SELECT s.*, p.nom_prov
         FROM Suministra s
         JOIN Proveedor p ON p.cod_prov = s.fk_cod_prov
         WHERE s.stock < s.stock_minimo
         ORDER BY s.id`
    );

module.exports = {
    findAllSuppliers,
    countAllSuppliers,
    findSupplierById,
    createSupplier,
    updateSupplier,
    removeSupplier,
    findAllMovements,
    countAllMovements,
    createMovement,
    findAllSuministra,
    countAllSuministra,
    findSuministraById,
    updateStock,
    upsertSuministra,
    findLowStock,
};
