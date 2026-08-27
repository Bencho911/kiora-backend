import db from '../config/db';
import { Cliente } from '../models/types';

export const findByEmail = (correo_usu: string) =>
    db.query('SELECT * FROM Cliente WHERE correo_usu = $1 AND activo = true', [correo_usu]);

export const findById = (id_usu: number) =>
    db.query(
        `SELECT id_usu, nom_usu, correo_usu, rol_usu, scope_type, scope_id, bloqueado_hasta, session_version
         FROM Cliente WHERE id_usu = $1 AND activo = true`,
        [id_usu]
    );

export const getSessionVersion = (id_usu: number) =>
    db.query(
        'SELECT session_version FROM Cliente WHERE id_usu = $1 AND activo = true',
        [id_usu]
    );

export const findByIdWithPassword = (id_usu: number) =>
    db.query(
        'SELECT * FROM Cliente WHERE id_usu = $1 AND activo = true',
        [id_usu]
    );

export const findProfile = (id_usu: number) =>
    db.query(
        'SELECT id_usu, nom_usu, correo_usu, rol_usu, scope_type, scope_id, tel_usu FROM Cliente WHERE id_usu = $1 AND activo = true',
        [id_usu]
    );

export const findAll = (limit = 20, offset = 0) =>
    db.query(
        `SELECT id_usu, nom_usu, correo_usu, rol_usu, scope_type, scope_id, tel_usu, intentos_fallidos, bloqueado_hasta
         FROM Cliente
         WHERE activo = true
         ORDER BY id_usu
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

export const countAll = () =>
    db.query('SELECT COUNT(*) FROM Cliente WHERE activo = true');

export const findAdmins = () =>
    db.query(
        `SELECT correo_usu FROM Cliente WHERE activo = true AND rol_usu = 'admin'`
    );

export const create = (nom_usu: string, correo_usu: string, hashedPassword: string, rol_usu?: string, scope_type?: string | null, scope_id?: number | null, tel_usu?: string) =>
    db.query(
        `INSERT INTO Cliente (nom_usu, correo_usu, password_usu, rol_usu, scope_type, scope_id, tel_usu)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_usu`,
        [nom_usu, correo_usu, hashedPassword, rol_usu || 'customer', scope_type || null, scope_id || null, tel_usu || null]
    );

export const update = (id_usu: number, fields: Partial<Cliente>) => {
    const allowed = ['nom_usu', 'correo_usu', 'tel_usu', 'rol_usu', 'scope_type', 'scope_id'];
    const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
    const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
    return db.query(
        `UPDATE Cliente SET ${setClauses}
         WHERE id_usu = $${entries.length + 1} AND activo = true
         RETURNING id_usu, nom_usu, correo_usu, rol_usu, scope_type, scope_id, tel_usu`,
        [...entries.map(([, val]) => val), id_usu]
    );
};

export const softDelete = (id_usu: number) =>
    db.query(
        'UPDATE Cliente SET activo = false WHERE id_usu = $1 AND activo = true RETURNING id_usu',
        [id_usu]
    );

export const updateRole = (id_usu: number, rol_usu: string, scope_type?: string | null, scope_id?: number | null) =>
    db.query(
        `UPDATE Cliente SET rol_usu = $1, scope_type = $2, scope_id = $3
         WHERE id_usu = $4 AND activo = true
         RETURNING id_usu, nom_usu, correo_usu, rol_usu, scope_type, scope_id`,
        [rol_usu, scope_type || null, scope_id || null, id_usu]
    );

export const incrementLoginAttempts = (id_usu: number, intentos: number) =>
    db.query(
        'UPDATE Cliente SET intentos_fallidos = $1 WHERE id_usu = $2',
        [intentos, id_usu]
    );

export const blockUser = (id_usu: number, intentos: number) =>
    db.query(
        `UPDATE Cliente SET intentos_fallidos = $1, bloqueado_hasta = '9999-12-31 23:59:59' WHERE id_usu = $2 RETURNING id_usu, nom_usu, correo_usu`,
        [intentos, id_usu]
    );

export const resetLoginAttempts = (id_usu: number) =>
    db.query(
        'UPDATE Cliente SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usu = $1',
        [id_usu]
    );

export const unlock = (id_usu: number) =>
    db.query(
        'UPDATE Cliente SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usu = $1 RETURNING id_usu, nom_usu, correo_usu',
        [id_usu]
    );

export const createResetToken = (id_usu: number, token: string, expira_en: Date) =>
    db.query(
        'INSERT INTO reset_tokens (id_usu, token, expira_en) VALUES ($1, $2, $3)',
        [id_usu, token, expira_en]
    );

export const invalidateActiveResetTokens = (id_usu: number) =>
    db.query(
        'UPDATE reset_tokens SET usado = true WHERE id_usu = $1 AND usado = false',
        [id_usu]
    );

export const findResetToken = (token: string) =>
    db.query(
        `SELECT rt.id, rt.id_usu, rt.expira_en
         FROM reset_tokens rt
         WHERE rt.token = $1 AND rt.usado = false AND rt.expira_en > NOW()`,
        [token]
    );

export const findValidResetCodeByEmail = (correo_usu: string, code: string) =>
    db.query(
        `SELECT rt.id, rt.id_usu, rt.expira_en
         FROM reset_tokens rt
         JOIN Cliente c ON c.id_usu = rt.id_usu
         WHERE c.correo_usu = $1
           AND c.activo = true
           AND rt.token = $2
           AND rt.usado = false
           AND rt.expira_en > NOW()`,
        [correo_usu, code]
    );

export const markTokenAsUsed = (token: string) =>
    db.query(
        'UPDATE reset_tokens SET usado = true WHERE token = $1',
        [token]
    );

export const updatePassword = (id_usu: number, hashedPassword: string) =>
    db.query(
        `UPDATE Cliente
         SET password_usu = $1, session_version = session_version + 1
         WHERE id_usu = $2 RETURNING id_usu`,
        [hashedPassword, id_usu]
    );

export const resetPasswordWithToken = async (plainToken: string, hashedPassword: string) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const sel = await client.query(
            `SELECT id_usu FROM reset_tokens
             WHERE token = $1 AND usado = false AND expira_en > NOW()
             FOR UPDATE`,
            [plainToken]
        );
        if (sel.rows.length === 0) {
            await client.query('ROLLBACK');
            return { ok: false };
        }
        const { id_usu } = sel.rows[0];
        const userUpd = await client.query(
            `UPDATE Cliente
             SET password_usu = $1, session_version = session_version + 1
             WHERE id_usu = $2 AND activo = true
             RETURNING id_usu`,
            [hashedPassword, id_usu]
        );
        if (userUpd.rows.length === 0) {
            await client.query('ROLLBACK');
            return { ok: false };
        }
        await client.query(
            'UPDATE reset_tokens SET usado = true WHERE token = $1',
            [plainToken]
        );
        await client.query('COMMIT');
        return { ok: true, id_usu };
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* ignore */
        }
        throw err;
    } finally {
        client.release();
    }
};

export const resetPasswordWithCode = async (correo_usu: string, code: string, hashedPassword: string) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const sel = await client.query(
            `SELECT rt.id, rt.id_usu
             FROM reset_tokens rt
             JOIN Cliente c ON c.id_usu = rt.id_usu
             WHERE c.correo_usu = $1
               AND c.activo = true
               AND rt.token = $2
               AND rt.usado = false
               AND rt.expira_en > NOW()
             FOR UPDATE`,
            [correo_usu, code]
        );
        if (sel.rows.length === 0) {
            await client.query('ROLLBACK');
            return { ok: false };
        }
        const { id, id_usu } = sel.rows[0];
        const userUpd = await client.query(
            `UPDATE Cliente
             SET password_usu = $1, session_version = session_version + 1
             WHERE id_usu = $2 AND activo = true
             RETURNING id_usu`,
            [hashedPassword, id_usu]
        );
        if (userUpd.rows.length === 0) {
            await client.query('ROLLBACK');
            return { ok: false };
        }
        await client.query('UPDATE reset_tokens SET usado = true WHERE id = $1', [id]);
        await client.query('COMMIT');
        return { ok: true, id_usu };
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* ignore */
        }
        throw err;
    } finally {
        client.release();
    }
};
