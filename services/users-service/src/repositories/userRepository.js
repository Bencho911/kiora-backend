const db = require('../config/db');

/**
 * userRepository
 * Responsabilidad única: todas las operaciones de acceso a datos
 * de la tabla Cliente. Ningún archivo externo hace queries directas.
 */

const findByEmail = (correo_usu) =>
    db.query('SELECT * FROM Cliente WHERE correo_usu = $1 AND activo = true', [correo_usu]);

const findById = (id_usu) =>
    db.query(
        `SELECT id_usu, nom_usu, correo_usu, rol_usu, bloqueado_hasta, session_version
         FROM Cliente WHERE id_usu = $1 AND activo = true`,
        [id_usu]
    );

/**
 * Versión de sesión para invalidar JWT tras cambio/restablecimiento de contraseña.
 * @param {number} id_usu
 */
const getSessionVersion = (id_usu) =>
    db.query(
        'SELECT session_version FROM Cliente WHERE id_usu = $1 AND activo = true',
        [id_usu]
    );

/**
 * Igual a findById pero incluye password_usu para comparación interna.
 * Nunca exponer este resultado directamente en la respuesta HTTP.
 * @param {number} id_usu
 */
const findByIdWithPassword = (id_usu) =>
    db.query(
        'SELECT * FROM Cliente WHERE id_usu = $1 AND activo = true',
        [id_usu]
    );

const findProfile = (id_usu) =>
    db.query(
        'SELECT id_usu, nom_usu, correo_usu, rol_usu, tel_usu FROM Cliente WHERE id_usu = $1 AND activo = true',
        [id_usu]
    );

const findAll = (limit = 20, offset = 0) =>
    db.query(
        `SELECT id_usu, nom_usu, correo_usu, rol_usu, tel_usu, intentos_fallidos, bloqueado_hasta
         FROM Cliente
         WHERE activo = true
         ORDER BY id_usu
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

const countAll = () =>
    db.query('SELECT COUNT(*) FROM Cliente WHERE activo = true');

const create = (nom_usu, correo_usu, hashedPassword, rol_usu, tel_usu) =>
    db.query(
        `INSERT INTO Cliente (nom_usu, correo_usu, password_usu, rol_usu, tel_usu)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_usu`,
        [nom_usu, correo_usu, hashedPassword, rol_usu || 'cliente', tel_usu || null]
    );

/**
 * Actualiza los campos permitidos de un usuario.
 * Solo actualiza los campos presentes en el objeto fields.
 * @param {number} id_usu
 * @param {{ nom_usu?: string, correo_usu?: string, tel_usu?: string }} fields
 */
const update = (id_usu, fields) => {
    const allowed = ['nom_usu', 'correo_usu', 'tel_usu', 'rol_usu'];
    const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
    const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
    return db.query(
        `UPDATE Cliente SET ${setClauses}
         WHERE id_usu = $${entries.length + 1} AND activo = true
         RETURNING id_usu, nom_usu, correo_usu, rol_usu, tel_usu`,
        [...entries.map(([, val]) => val), id_usu]
    );
};

/**
 * Marca el usuario como inactivo (soft delete).
 * Los datos se conservan para integridad referencial.
 * @param {number} id_usu
 */
const softDelete = (id_usu) =>
    db.query(
        'UPDATE Cliente SET activo = false WHERE id_usu = $1 AND activo = true RETURNING id_usu',
        [id_usu]
    );

/**
 * Cambia el rol de un usuario.
 * @param {number} id_usu
 * @param {string} rol_usu
 */
const updateRole = (id_usu, rol_usu) =>
    db.query(
        `UPDATE Cliente SET rol_usu = $1
         WHERE id_usu = $2 AND activo = true
         RETURNING id_usu, nom_usu, correo_usu, rol_usu`,
        [rol_usu, id_usu]
    );

const incrementLoginAttempts = (id_usu, intentos) =>
    db.query(
        'UPDATE Cliente SET intentos_fallidos = $1 WHERE id_usu = $2',
        [intentos, id_usu]
    );

const blockUser = (id_usu, intentos) =>
    db.query(
        `UPDATE Cliente SET intentos_fallidos = $1, bloqueado_hasta = '9999-12-31 23:59:59' WHERE id_usu = $2`,
        [intentos, id_usu]
    );

const resetLoginAttempts = (id_usu) =>
    db.query(
        'UPDATE Cliente SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usu = $1',
        [id_usu]
    );

const unlock = (id_usu) =>
    db.query(
        'UPDATE Cliente SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usu = $1 RETURNING id_usu, nom_usu, correo_usu',
        [id_usu]
    );

/**
 * Guarda un token de recuperación de contraseña en la BD.
 * @param {number} id_usu
 * @param {string} token
 * @param {Date} expira_en
 */
const createResetToken = (id_usu, token, expira_en) =>
    db.query(
        'INSERT INTO reset_tokens (id_usu, token, expira_en) VALUES ($1, $2, $3)',
        [id_usu, token, expira_en]
    );

const invalidateActiveResetTokens = (id_usu) =>
    db.query(
        'UPDATE reset_tokens SET usado = true WHERE id_usu = $1 AND usado = false',
        [id_usu]
    );

/**
 * Busca un token válido (no usado y no expirado).
 * @param {string} token
 */
const findResetToken = (token) =>
    db.query(
        `SELECT rt.id, rt.id_usu, rt.expira_en
         FROM reset_tokens rt
         WHERE rt.token = $1 AND rt.usado = false AND rt.expira_en > NOW()`,
        [token]
    );

const findValidResetCodeByEmail = (correo_usu, code) =>
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

/**
 * Marca un token como usado para que no pueda reutilizarse.
 * @param {string} token
 */
const markTokenAsUsed = (token) =>
    db.query(
        'UPDATE reset_tokens SET usado = true WHERE token = $1',
        [token]
    );

/**
 * Actualiza la contraseña del usuario.
 * @param {number} id_usu
 * @param {string} hashedPassword
 */
const updatePassword = (id_usu, hashedPassword) =>
    db.query(
        `UPDATE Cliente
         SET password_usu = $1, session_version = session_version + 1
         WHERE id_usu = $2 RETURNING id_usu`,
        [hashedPassword, id_usu]
    );

/**
 * Restablece contraseña y marca el token de recuperación en una sola transacción.
 * Usa FOR UPDATE sobre el token para evitar carreras con el mismo token.
 * @param {string} plainToken
 * @param {string} hashedPassword
 * @returns {Promise<{ ok: true, id_usu: number } | { ok: false }>}
 */
const resetPasswordWithToken = async (plainToken, hashedPassword) => {
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
        const userUpd =         await client.query(
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

const resetPasswordWithCode = async (correo_usu, code, hashedPassword) => {
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

module.exports = {
    findByEmail,
    findById,
    getSessionVersion,
    findByIdWithPassword,
    findProfile,
    findAll,
    countAll,
    create,
    update,
    softDelete,
    updateRole,
    incrementLoginAttempts,
    blockUser,
    resetLoginAttempts,
    unlock,
    createResetToken,
    invalidateActiveResetTokens,
    findResetToken,
    findValidResetCodeByEmail,
    markTokenAsUsed,
    updatePassword,
    resetPasswordWithToken,
    resetPasswordWithCode,
};
