'use strict';

const db = require('../config/db');

/**
 * orderRepository
 * Responsabilidad única: acceso a datos de Ventas y Producto_Venta.
 */

/* ── Ventas ──────────────────────────────────────────────────────────────── */

const findAll = ({ limit = 20, offset = 0 } = {}) =>
    db.query(
        `SELECT v.*, 
            (SELECT string_agg(COALESCE(nom_prod, 'Prod #' || cod_prod), ', ') FROM Producto_Venta pv WHERE pv.fk_id_vent = v.id_vent) as productos_resumen
         FROM Ventas v 
         ORDER BY fecha_vent DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

const countAll = () =>
    db.query('SELECT COUNT(*) FROM Ventas');

const findById = (id_vent) =>
    db.query('SELECT * FROM Ventas WHERE id_vent = $1', [id_vent]);

/**
 * Busca una venta con sus líneas de detalle.
 * @param {number} id_vent
 */
const findByIdWithItems = async (id_vent) => {
    const [venta, items] = await Promise.all([
        db.query('SELECT * FROM Ventas WHERE id_vent = $1', [id_vent]),
        db.query(
            'SELECT * FROM Producto_Venta WHERE fk_id_vent = $1 ORDER BY id',
            [id_vent]
        ),
    ]);
    if (venta.rows.length === 0) return null;
    return { ...venta.rows[0], items: items.rows };
};

/**
 * Crea una venta con sus líneas en una sola transacción.
 * @param {{ metodopago_usu, items: Array<{cod_prod, cantidad, precio_unit}> }} data
 */
const createWithItems = async ({ metodopago_usu, items, id_usu }) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const montofinal = items.reduce(
            (sum, i) => sum + Number(i.precio_unit) * Number(i.cantidad),
            0
        );
        const precio_prod_final = items.length > 0 ? Number(items[0].precio_unit) : 0;

        const ventaRes = await client.query(
            `INSERT INTO Ventas (precio_prod_final, montofinal_vent, metodopago_usu, estado)
             VALUES ($1, $2, $3, 'pendiente') RETURNING *`,
            [precio_prod_final, montofinal.toFixed(2), metodopago_usu || null]
        );
        const venta = ventaRes.rows[0];

        const itemRows = [];
        for (const item of items) {
            const r = await client.query(
                `INSERT INTO Producto_Venta (fk_id_vent, cod_prod, cantidad, precio_unit, nom_prod)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [venta.id_vent, item.cod_prod, item.cantidad, item.precio_unit, item.nom_prod || null]
            );
            itemRows.push(r.rows[0]);
        }

        await client.query('COMMIT');
        return { ...venta, items: itemRows };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Inserta un evento en la tabla outbox_events.
 * Diseñado para llamarse dentro de una transacción existente o de forma standalone.
 *
 * @param {string} eventType — Tipo de evento (ej: 'inventory.movement')
 * @param {object} payload — Datos del evento
 * @param {object} [client] — Cliente PG de una transacción activa (opcional)
 */
const insertOutboxEvent = async (eventType, payload, client) => {
    const conn = client || db;
    return conn.query(
        `INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2) RETURNING *`,
        [eventType, JSON.stringify(payload)]
    );
};

/**
 * Cambia el estado de una venta.
 * @param {number} id_vent
 * @param {string} estado — 'pendiente' | 'completada' | 'cancelada'
 */
const updateStatus = (id_vent, estado) =>
    db.query(
        'UPDATE Ventas SET estado = $1 WHERE id_vent = $2 RETURNING *',
        [estado, id_vent]
    );

const remove = (id_vent) =>
    db.query('DELETE FROM Ventas WHERE id_vent = $1 RETURNING id_vent', [id_vent]);

module.exports = {
    findAll,
    countAll,
    findById,
    findByIdWithItems,
    createWithItems,
    insertOutboxEvent,
    updateStatus,
    remove,
};
