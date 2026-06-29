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

const findSupplierByIdProv = (id_prov, exclude_cod_prov = null) => {
    if (exclude_cod_prov) {
        return db.query('SELECT * FROM Proveedor WHERE id_prov = $1 AND cod_prov != $2', [id_prov, exclude_cod_prov]);
    }
    return db.query('SELECT * FROM Proveedor WHERE id_prov = $1', [id_prov]);
};

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
        `SELECT s.*, p.nom_prov, p.correo_prov
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

const findSuministraByProduct = (cod_prod) =>
    db.query(
        `SELECT s.*, p.nom_prov, p.correo_prov
         FROM Suministra s
         JOIN Proveedor p ON p.cod_prov = s.fk_cod_prov
         WHERE s.cod_prod = $1
         ORDER BY s.id LIMIT 1`,
        [cod_prod]
    );

/**
 * Actualiza el stock sumando o restando un delta.
 * Si es resta (venta), aplica lógica FEFO descontando de lotes.
 * Mantiene la tabla Suministra actualizada para compatibilidad con el frontend.
 */
const updateStock = async (cod_prod, delta, fk_cod_prov = null, fecha_vencimiento = null) => {
    const supplierId = fk_cod_prov || 1;
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        let lotesAfectados = [];
        
        if (delta > 0) {
            // ENTRADA de inventario
            const numeroLote = `LOTE-${Date.now()}`;

            // Check for duplicate batch name within the same product
            const existingLote = await client.query(
                `SELECT id FROM lotes WHERE cod_prod = $1 AND LOWER(TRIM(numero_lote)) = LOWER(TRIM($2)) AND estado = 'ACTIVO'`,
                [cod_prod, numeroLote]
            );
            if (existingLote.rows.length > 0) {
                throw new Error(`Ya existe un lote activo con el nombre "${numeroLote}" para este producto.`);
            }

            const resLote = await client.query(
                `INSERT INTO lotes (cod_prod, numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_actual)
                 VALUES ($1, $2, $3, $4, $4) RETURNING *`,
                [cod_prod, numeroLote, fecha_vencimiento, delta]
            );
            
            await client.query(
                `INSERT INTO movimientos_lote (lote_id, tipo_mov, cantidad, desc_mov)
                 VALUES ($1, 'entrada', $2, 'Entrada de inventario')`,
                [resLote.rows[0].id, delta]
            );
            
        } else if (delta < 0) {
            // SALIDA de inventario (Descuento FEFO)
            let remainingToDeduct = Math.abs(delta);
            
            // Buscar lotes ordenados por fecha de vencimiento (FEFO)
            const resLotes = await client.query(
                `SELECT id, cantidad_actual FROM lotes 
                 WHERE cod_prod = $1 AND estado = 'ACTIVO' AND cantidad_actual > 0
                 ORDER BY fecha_vencimiento ASC NULLS LAST, fecha_ingreso ASC FOR UPDATE`,
                [cod_prod]
            );
            
            for (const lote of resLotes.rows) {
                if (remainingToDeduct <= 0) break;
                
                const deductFromLote = Math.min(lote.cantidad_actual, remainingToDeduct);
                remainingToDeduct -= deductFromLote;
                
                const newCantidad = lote.cantidad_actual - deductFromLote;
                const newEstado = newCantidad === 0 ? 'AGOTADO' : 'ACTIVO';
                
                await client.query(
                    `UPDATE lotes SET cantidad_actual = $1, estado = $2 WHERE id = $3`,
                    [newCantidad, newEstado, lote.id]
                );
                
                await client.query(
                    `INSERT INTO movimientos_lote (lote_id, tipo_mov, cantidad, desc_mov)
                     VALUES ($1, 'salida', $2, 'Descuento por venta FEFO')`,
                    [lote.id, deductFromLote]
                );
                
                lotesAfectados.push({ lote_id: lote.id, cantidad: deductFromLote });
            }
            
            if (remainingToDeduct > 0) {
                // Si no hay lotes suficientes, forzamos negativo en Suministra y registramos warning.
                console.warn(`[STOCK WARNING] Stock negativo para cod_prod ${cod_prod}. Faltaron ${remainingToDeduct} unidades.`);
            }
        }
        
        // Actualización Legacy para la tabla Suministra (para no quebrar frontend)
        let vencimientoSet = '';
        const params = [supplierId, cod_prod, delta];
        let paramIndex = 4;

        if (fecha_vencimiento) {
            vencimientoSet = `, fecha_vencimiento = $${paramIndex}`;
            params.push(fecha_vencimiento);
            paramIndex++;
        }

        const legacyRes = await client.query(
            `INSERT INTO Suministra (fk_cod_prov, cod_prod, stock, stock_minimo)
             VALUES ($1, $2, GREATEST(0, $3), 0)
             ON CONFLICT (fk_cod_prov, cod_prod)
             DO UPDATE SET stock = GREATEST(0, Suministra.stock + $3)${vencimientoSet}
             RETURNING *`,
            params
        );
        
        await client.query('COMMIT');
        return legacyRes;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
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
        `SELECT s.*, p.nom_prov, p.correo_prov
         FROM Suministra s
         JOIN Proveedor p ON p.cod_prov = s.fk_cod_prov
         WHERE s.stock < s.stock_minimo
         ORDER BY s.id`
    );

/**
 * Obtener trazabilidad (Kardex) de un producto
 */
const getKardexByProduct = (cod_prod) =>
    db.query(
        `SELECT ml.id, ml.tipo_mov, ml.cantidad, ml.fecha_mov, ml.desc_mov, l.numero_lote 
         FROM movimientos_lote ml
         JOIN lotes l ON l.id = ml.lote_id
         WHERE l.cod_prod = $1
         ORDER BY ml.fecha_mov DESC`,
        [cod_prod]
    );

/**
 * Obtener todos los lotes de un producto
 */
const findLotesByProduct = (cod_prod) =>
    db.query(
        `SELECT * FROM lotes 
         WHERE cod_prod = $1 AND estado = 'ACTIVO'
         ORDER BY fecha_ingreso DESC`,
        [cod_prod]
    );

/**
 * Eliminar (inactivar) lote manualmente y generar historial
 */
const deleteLote = async (loteId) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Obtener datos del lote
        const loteRes = await client.query('SELECT * FROM lotes WHERE id = $1 FOR UPDATE', [loteId]);
        if (loteRes.rows.length === 0) throw new Error('Lote no encontrado');
        const lote = loteRes.rows[0];

        if (lote.cantidad_actual > 0) {
            // 2. Registrar movimiento de salida
            await client.query(
                `INSERT INTO movimientos_lote (lote_id, tipo_mov, cantidad, desc_mov)
                 VALUES ($1, 'salida', $2, 'Lote eliminado manualmente')`,
                [lote.id, lote.cantidad_actual]
            );

            // 3. Notificar a Products Service para restar el stock
            try {
                // Hacemos un PUT a /api/products/:cod_prod/stock con delta negativo
                await fetch(`${process.env.PRODUCTS_SERVICE_URL || 'http://products:3002'}/api/products/${lote.cod_prod}/stock`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cantidad: -lote.cantidad_actual })
                });
            } catch (err) {
                console.error('Error descontando stock en el servicio de productos', err);
            }
        }

        // 4. Inactivar el lote y poner en 0
        await client.query(
            `UPDATE lotes SET estado = 'INACTIVO', cantidad_actual = 0 WHERE id = $1`,
            [loteId]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Obtener alertas de inventario (Bajo stock y lotes por vencer/vencidos)
 */
const getAlerts = async () => {
    const lowStock = await findLowStock();
    const expiringBatches = await db.query(
        `SELECT l.*
         FROM lotes l
         WHERE l.estado = 'ACTIVO'
         AND l.fecha_vencimiento IS NOT NULL
         AND l.fecha_vencimiento <= (CURRENT_DATE + INTERVAL '30 days')
         ORDER BY l.fecha_vencimiento ASC`
    );
    
    return {
        lowStock: lowStock.rows,
        expiringBatches: expiringBatches.rows
    };
};

/**
 * Check if a lote with the given name already exists for a product (case-insensitive)
 */
const findLoteByName = (cod_prod, numero_lote) =>
    db.query(
        `SELECT id, numero_lote, estado FROM lotes 
         WHERE cod_prod = $1 AND LOWER(TRIM(numero_lote)) = LOWER(TRIM($2)) AND estado = 'ACTIVO'`,
        [cod_prod, numero_lote]
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
    findSuministraByProduct,
    updateStock,
    upsertSuministra,
    findLowStock,
    getKardexByProduct,
    getAlerts,
    findSupplierByIdProv,
    findLotesByProduct,
    findLoteByName,
    deleteLote,
};
