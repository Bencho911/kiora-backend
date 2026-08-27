import db from '../config/db';
import { Tienda, Mesa } from '../models/types';

// ── Tiendas ────────────────────────────────────────────────────────────────

export async function findAll({ soloActivas = false }: { soloActivas?: boolean } = {}): Promise<Tienda[]> {
    const whereClause = soloActivas ? 'WHERE t.activa = TRUE' : '';
    const { rows } = await db.query(
        `SELECT t.id_tienda, t.nombre, t.direccion, t.telefono, t.factus_prefix, 
                t.activa, t.estado, t.latitud, t.longitud, t.creado_en, t.fk_ciudad_id,
                c.nombre AS ciudad_nombre,
                r.id AS regional_id, r.nombre AS regional_nombre
         FROM Tienda t
         LEFT JOIN Ciudad c ON t.fk_ciudad_id = c.id
         LEFT JOIN Regional r ON c.fk_regional_id = r.id
         ${whereClause}
         ORDER BY t.id_tienda ASC`
    );
    return rows;
}

export async function findById(id: number): Promise<Tienda | null> {
    const { rows } = await db.query(
        `SELECT t.id_tienda, t.nombre, t.direccion, t.telefono, t.factus_prefix, 
                t.activa, t.estado, t.latitud, t.longitud, t.creado_en, t.fk_ciudad_id,
                c.nombre AS ciudad_nombre,
                r.id AS regional_id, r.nombre AS regional_nombre
         FROM Tienda t
         LEFT JOIN Ciudad c ON t.fk_ciudad_id = c.id
         LEFT JOIN Regional r ON c.fk_regional_id = r.id
         WHERE t.id_tienda = $1`,
        [id]
    );
    return rows[0] || null;
}

export async function create({ nombre, direccion, telefono, factus_prefix, latitud, longitud, fk_ciudad_id }: Partial<Tienda>): Promise<Tienda> {
    const { rows } = await db.query(
        `INSERT INTO Tienda (nombre, direccion, telefono, factus_prefix, latitud, longitud, fk_ciudad_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [nombre, direccion, telefono || null, factus_prefix || 'K', latitud || null, longitud || null, fk_ciudad_id || null]
    );
    return rows[0];
}

export async function update(id: number, { nombre, direccion, telefono, factus_prefix, activa, latitud, longitud, fk_ciudad_id }: Partial<Tienda>): Promise<Tienda | null> {
    const { rows } = await db.query(
        `UPDATE Tienda
         SET nombre = COALESCE($1, nombre),
             direccion = COALESCE($2, direccion),
             telefono = COALESCE($3, telefono),
             factus_prefix = COALESCE($4, factus_prefix),
             activa = COALESCE($5, activa),
             latitud = COALESCE($6, latitud),
             longitud = COALESCE($7, longitud),
             fk_ciudad_id = COALESCE($8, fk_ciudad_id)
         WHERE id_tienda = $9
         RETURNING *`,
        [nombre, direccion, telefono, factus_prefix, activa, latitud, longitud, fk_ciudad_id, id]
    );
    return rows[0] || null;
}

export async function updateEstado(id: number, estado: string): Promise<Partial<Tienda> | null> {
    const ESTADOS_VALIDOS = ['ABIERTO', 'CERRADO', 'OFFLINE'];
    if (!ESTADOS_VALIDOS.includes(estado)) {
        throw new Error(`Estado inválido: ${estado}. Use: ${ESTADOS_VALIDOS.join(', ')}`);
    }
    const { rows } = await db.query(
        `UPDATE Tienda SET estado = $1 WHERE id_tienda = $2 RETURNING id_tienda, nombre, estado`,
        [estado, id]
    );
    return rows[0] || null;
}

// ── Mesas ──────────────────────────────────────────────────────────────────

export async function findByScope(scopeType: string, scopeId: number): Promise<number[]> {
    if (scopeType === 'GLOBAL') {
        const { rows } = await db.query('SELECT id_tienda FROM Tienda WHERE activa = TRUE');
        return rows.map(r => r.id_tienda);
    }
    if (scopeType === 'TIENDA') {
        return [scopeId];
    }
    if (scopeType === 'CIUDAD') {
        const { rows } = await db.query('SELECT id_tienda FROM Tienda WHERE fk_ciudad_id = $1 AND activa = TRUE', [scopeId]);
        return rows.map(r => r.id_tienda);
    }
    if (scopeType === 'REGIONAL') {
        const { rows } = await db.query(`
            SELECT t.id_tienda 
            FROM Tienda t
            JOIN Ciudad c ON t.fk_ciudad_id = c.id
            WHERE c.fk_regional_id = $1 AND t.activa = TRUE
        `, [scopeId]);
        return rows.map(r => r.id_tienda);
    }
    return [];
}

export async function findMesasByTienda(storeId: number): Promise<any[]> {
    const { rows } = await db.query(
        `SELECT id_mesa, fk_id_tienda, numero, qr_code, activa, creado_en
         FROM Mesa
         WHERE fk_id_tienda = $1 AND activa = TRUE
         ORDER BY numero ASC`,
        [storeId]
    );
    return rows;
}

export async function createMesa(storeId: number, numero: number): Promise<any> {
    const qrCode = `kiora://tienda=${storeId}&mesa=${numero}`;
    const { rows } = await db.query(
        `INSERT INTO Mesa (fk_id_tienda, numero, qr_code)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [storeId, numero, qrCode]
    );
    return rows[0];
}

export async function findMesaByQR(qrCode: string): Promise<any | null> {
    const { rows } = await db.query(
        `SELECT m.id_mesa, m.fk_id_tienda, m.numero, m.qr_code,
                t.nombre AS nombre_tienda, t.estado AS estado_tienda
         FROM Mesa m
         JOIN Tienda t ON m.fk_id_tienda = t.id_tienda
         WHERE m.qr_code = $1 AND m.activa = TRUE`,
        [qrCode]
    );
    return rows[0] || null;
}

export default {
    findAll,
    findById,
    create,
    update,
    updateEstado,
    findMesasByTienda,
    createMesa,
    findMesaByQR,
    findByScope,
};
