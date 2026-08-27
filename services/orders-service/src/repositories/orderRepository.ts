import db from '../config/db';

/**
 * orderRepository
 * Responsabilidad única: acceso a datos de Ventas y Producto_Venta.
 */

/* ── Ventas ──────────────────────────────────────────────────────────────── */

export const findAll = ({ limit = 20, offset = 0, store_id = null }: any = {}) => {
    if (store_id) {
        return db.query(
            `SELECT v.*, 
                (SELECT string_agg(COALESCE(nom_prod, 'Prod #' || cod_prod), ', ') FROM Producto_Venta pv WHERE pv.fk_id_vent = v.id_vent) as productos_resumen
             FROM Ventas v 
             WHERE v.store_id = $1
             ORDER BY fecha_vent DESC 
             LIMIT $2 OFFSET $3`,
            [store_id, limit, offset]
        );
    }
    return db.query(
        `SELECT v.*, 
            (SELECT string_agg(COALESCE(nom_prod, 'Prod #' || cod_prod), ', ') FROM Producto_Venta pv WHERE pv.fk_id_vent = v.id_vent) as productos_resumen
         FROM Ventas v 
         ORDER BY fecha_vent DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
};

export const countAll = () =>
    db.query('SELECT COUNT(*) FROM Ventas');

export const findById = (id_vent: string | number) =>
    db.query('SELECT * FROM Ventas WHERE id_vent = $1', [id_vent]);

/**
 * Busca una venta con sus líneas de detalle.
 * @param {number} id_vent
 */
export const findByIdWithItems = async (id_vent: string | number) => {
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
 * @param {{ metodopago_usu, items, descuento_global, store_id, tipo_entrega, fk_id_mesa }} data
 */
export const createWithItems = async ({ metodopago_usu, items, descuento_global, store_id = 1, tipo_entrega = 'PICKUP', fk_id_mesa = null }: any) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        let montofinal = items.reduce(
            (sum: number, i: any) => sum + Number(i.precio_unit) * Number(i.cantidad),
            0
        );
        if (descuento_global && descuento_global > 0) {
            montofinal = montofinal * (1 - Math.min(descuento_global, 100) / 100);
        }
        const precio_prod_final = items.length > 0 ? Number(items[0].precio_unit) : 0;

        // Buscar sesión ABIERTA para la tienda específica
        const sessionRes = await client.query("SELECT id FROM sesion_caja WHERE estado = 'ABIERTA' AND store_id = $1", [store_id]);
        if (sessionRes.rows.length === 0) {
            throw { status: 403, message: 'La caja de esta tienda está cerrada. Debes abrir una sesión para realizar ventas.', code: 'BUSINESS_CLOSED' };
        }
        const sesion_id = sessionRes.rows[0].id;

        const ventaRes = await client.query(
            `INSERT INTO Ventas (precio_prod_final, montofinal_vent, metodopago_usu, estado, sesion_id, store_id, tipo_entrega, fk_id_mesa)
             VALUES ($1, $2, $3, 'pendiente', $4, $5, $6, $7) RETURNING *`,
            [precio_prod_final, montofinal.toFixed(2), metodopago_usu || null, sesion_id, store_id, tipo_entrega, fk_id_mesa]
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
export const insertOutboxEvent = async (eventType: string, payload: any, client?: any) => {
    const conn = client || db;
    return conn.query(
        `INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2) RETURNING *`,
        [eventType, JSON.stringify(payload)]
    );
};

/**
 * Cambia el estado de una venta.
 * @param {number} id_vent
 * @param {string} estado — 'pendiente' | 'completada' | 'cancelada' | 'reembolsada'
 * @param {object} [client=db] — Cliente PG de una transacción activa (opcional)
 */
export const updateStatus = (id_vent: string | number, estado: string, client = db) =>
    client.query(
        'UPDATE Ventas SET estado = $1 WHERE id_vent = $2 RETURNING *',
        [estado, id_vent]
    );

/**
 * Guarda el stripe_payment_id en una orden pagada (para reembolsos futuros).
 * @param {number} id_vent
 * @param {string} paymentIntent
 */
export const updatePaymentInfo = (id_vent: string | number, paymentIntent: string) =>
    db.query(
        'UPDATE Ventas SET stripe_payment_id = $1, metodopago_usu = $2 WHERE id_vent = $3',
        [paymentIntent, 'stripe_tarjeta', id_vent]
    );

export const remove = (id_vent: string | number) =>
    db.query('DELETE FROM Ventas WHERE id_vent = $1 RETURNING id_vent', [id_vent]);

export const getStats = async (fecha: string, period = '7d') => {
    const statsHoyQuery = db.query(
        `SELECT
            COUNT(*)::int AS total_ventas,
            COALESCE(SUM(montofinal_vent), 0) AS monto_total,
            CASE WHEN COUNT(*) > 0 THEN SUM(montofinal_vent) / COUNT(*) ELSE 0 END AS ticket_promedio,
            (SELECT row_to_json(v) FROM (
                SELECT id_vent, fecha_vent, montofinal_vent, estado, metodopago_usu
                FROM Ventas
                WHERE fecha_vent::date = $1::date
                  AND estado = 'completada'
                ORDER BY fecha_vent DESC LIMIT 1
            ) v) AS ultima_venta
         FROM Ventas
         WHERE fecha_vent::date = $1::date
           AND estado = 'completada'`,
        [fecha]
    );

    const statsAyerQuery = db.query(
        `SELECT
            COUNT(*)::int AS total_ventas,
            COALESCE(SUM(montofinal_vent), 0) AS monto_total,
            CASE WHEN COUNT(*) > 0 THEN SUM(montofinal_vent) / COUNT(*) ELSE 0 END AS ticket_promedio
         FROM Ventas
         WHERE fecha_vent::date = ($1::date - INTERVAL '1 day')
           AND estado = 'completada'`,
        [fecha]
    );

    const pagosHoyQuery = db.query(
        `SELECT 
            COUNT(*) FILTER (WHERE metodopago_usu ILIKE '%efectivo%')::int AS pagos_efectivo,
            COUNT(*) FILTER (WHERE metodopago_usu NOT ILIKE '%efectivo%' OR metodopago_usu IS NULL)::int AS pagos_tarjeta
         FROM Ventas
         WHERE fecha_vent::date = $1::date
           AND estado = 'completada'`,
        [fecha]
    );

    let evolucionQueryStr = '';
    
    if (period === 'this_month') {
        evolucionQueryStr = `
            SELECT 
                EXTRACT(DAY FROM d) AS dow,
                COALESCE(SUM(v.montofinal_vent), 0) AS total
            FROM generate_series(date_trunc('month', $1::date), date_trunc('month', $1::date) + interval '1 month' - interval '1 day', '1 day'::interval) d
            LEFT JOIN Ventas v ON v.fecha_vent::date = d::date AND v.estado = 'completada'
            GROUP BY d
            ORDER BY d`;
    } else if (period === 'this_year') {
        evolucionQueryStr = `
            SELECT 
                EXTRACT(MONTH FROM d) AS dow,
                COALESCE(SUM(v.montofinal_vent), 0) AS total
            FROM generate_series(date_trunc('year', $1::date), date_trunc('year', $1::date) + interval '11 months', '1 month'::interval) d
            LEFT JOIN Ventas v ON date_trunc('month', v.fecha_vent::date) = d::date AND v.estado = 'completada'
            GROUP BY d
            ORDER BY d`;
    } else {
        // default 7d
        evolucionQueryStr = `
            SELECT 
                EXTRACT(ISODOW FROM d) AS dow,
                COALESCE(SUM(v.montofinal_vent), 0) AS total
            FROM generate_series($1::date - INTERVAL '6 days', $1::date, '1 day'::interval) d
            LEFT JOIN Ventas v ON v.fecha_vent::date = d::date AND v.estado = 'completada'
            GROUP BY d
            ORDER BY d`;
    }

    const evolucionQuery = db.query(evolucionQueryStr, [fecha]);

    const [hoyRes, ayerRes, pagosRes, evolucionRes] = await Promise.all([
        statsHoyQuery,
        statsAyerQuery,
        pagosHoyQuery,
        evolucionQuery
    ]);

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const monthNames = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const evolucion = evolucionRes.rows.map((r: any) => {
        let name = 'X';
        if (period === 'this_month') {
            name = String(r.dow);
        } else if (period === 'this_year') {
            name = monthNames[Number(r.dow)] || 'X';
        } else {
            name = dayNames[Number(r.dow)] || 'X';
        }
        return {
            name,
            total: Number(r.total)
        };
    });

    return {
        hoy: hoyRes.rows[0] || { total_ventas: 0, monto_total: 0, ticket_promedio: 0, ultima_venta: null },
        ayer: ayerRes.rows[0] || { total_ventas: 0, monto_total: 0, ticket_promedio: 0 },
        pagos: pagosRes.rows[0] || { pagos_efectivo: 0, pagos_tarjeta: 0 },
        evolucion
    };
};

export const checkProductInSales = async (cod_prod: string | number) => {
    const result = await db.query(
        'SELECT 1 FROM Producto_Venta WHERE cod_prod = $1 LIMIT 1',
        [cod_prod]
    );
    return result.rows.length > 0;
};
