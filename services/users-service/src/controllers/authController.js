const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const authService = require('../services/authService');
const blacklist = require('../config/blacklist');
const { addToBlacklist } = require('../middleware/authMiddleware');
const emailService = require('../config/emailService');
const { client: redisClient } = require('../config/blacklist');
const logActivity = require('../utils/logActivity');
const logger = require('../config/logger');

const NOTIFICATIONS_STREAM = process.env.REDIS_NOTIFICATIONS_STREAM || 'kiora:notifications:stream';
const RESET_CODE_EXPIRY_MINUTES = emailService.RESET_CODE_EXPIRY_MINUTES;

const MAX_INTENTOS = 5;

/**
 * authController
 * Responsabilidad única: orquesta la lógica de negocio de autenticación y
 * gestión de usuarios. Delega acceso a datos al repositorio y errores a next(error).
 */

// POST /api/auth/register
const register = async (req, res, next) => {
    const { nom_usu, correo_usu, password, rol_usu, tel_usu } = req.body;

    try {
        const existing = await userRepository.findByEmail(correo_usu);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'El correo ya está registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await userRepository.create(nom_usu, correo_usu, hashedPassword, rol_usu, tel_usu);

        logger.info('Usuario registrado', { correo_usu, rol_usu: rol_usu || 'cliente' });
        res.status(201).json({
            message: 'Usuario registrado exitosamente.',
            id_usu: result.rows[0].id_usu
        });

        logActivity({ user_email: correo_usu, action: 'created', entity_type: 'user', entity_id: result.rows[0].id_usu, details: `Usuario "${nom_usu}" registrado con rol ${rol_usu || 'cliente'}` });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'El correo ya está registrado.' });
        }
        logger.error('Error al registrar usuario', { error: error.message });
        next(error);
    }
};

// POST /api/auth/login
const login = async (req, res, next) => {
    const { correo_usu, password } = req.body;

    try {
        const result = await userRepository.findByEmail(correo_usu);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const usuario = result.rows[0];

        // HU04 – Verificar bloqueo de cuenta
        if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
            logger.warn('Intento de login en cuenta bloqueada', { correo_usu });
            return res.status(423).json({
                error: 'Cuenta bloqueada. Contacta al administrador para desbloquearla.'
            });
        }

        const passwordValida = await bcrypt.compare(password, usuario.password_usu);
        if (!passwordValida) {
            const nuevoIntentos = (usuario.intentos_fallidos || 0) + 1;

            if (nuevoIntentos >= MAX_INTENTOS) {
                await userRepository.blockUser(usuario.id_usu, nuevoIntentos);
                logger.warn('Cuenta bloqueada por intentos fallidos', { correo_usu });
                return res.status(423).json({
                    error: 'Cuenta bloqueada por demasiados intentos fallidos. Contacta al administrador para desbloquearla.'
                });
            }

            await userRepository.incrementLoginAttempts(usuario.id_usu, nuevoIntentos);
            return res.status(401).json({
                error: `Credenciales incorrectas. Intento ${nuevoIntentos} de ${MAX_INTENTOS}.`
            });
        }

        // Login exitoso
        await userRepository.resetLoginAttempts(usuario.id_usu);
        logger.info('Login exitoso', { id_usu: usuario.id_usu, correo_usu });

        const token = authService.generateAccessToken(usuario);
        const refreshToken = authService.generateRefreshToken(usuario);

        res.cookie('kiora_refresh_token', refreshToken,
            authService.cookieOptions(authService.REFRESH_COOKIE_MAX_AGE));

        const isWebClient = req.headers['x-client-type'] === 'web';
        const usuarioPublico = {
            id_usu: usuario.id_usu,
            nom_usu: usuario.nom_usu,
            correo_usu: usuario.correo_usu,
            rol_usu: usuario.rol_usu,
            tel_usu: usuario.tel_usu,
        };

        if (isWebClient) {
            res.cookie('token', token, authService.cookieOptions(authService.ACCESS_COOKIE_MAX_AGE));
            res.status(200).json({ message: 'Login exitoso.', usuario: usuarioPublico });
        } else {
            res.status(200).json({ message: 'Login exitoso.', token, usuario: usuarioPublico });
        }

        logActivity({ user_email: correo_usu, action: 'login', entity_type: 'user', entity_id: usuario.id_usu, details: `Inicio de sesión — ${correo_usu}` });
    } catch (error) {
        logger.error('Error al iniciar sesión', { error: error.message });
        next(error);
    }
};

// POST /api/auth/refresh
const refresh = async (req, res, _next) => {
    const oldRefreshToken = req.cookies.kiora_refresh_token;

    if (!oldRefreshToken) {
        return res.status(401).json({ error: 'No se proporcionó un Refresh Token.' });
    }

    try {
        let isRevoked;
        try {
            isRevoked = await authService.isTokenRevoked(oldRefreshToken);
        } catch (e) {
            if (e.code === blacklist.BLACKLIST_UNAVAILABLE) {
                return res.status(503).json({
                    error: 'Servicio de sesiones temporalmente no disponible. Intenta de nuevo en unos segundos.',
                });
            }
            throw e;
        }
        if (isRevoked) {
            return res.status(401).json({ error: 'Refresh Token revocado. Inicia sesión nuevamente.' });
        }

        const decoded = authService.verifyRefreshToken(oldRefreshToken);
        const result = await userRepository.findById(decoded.id_usu);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no válido.' });
        }

        const usuario = result.rows[0];
        const refreshSv = decoded.sv !== undefined && decoded.sv !== null ? decoded.sv : 0;
        if (usuario.session_version !== refreshSv) {
            return res.status(401).json({ error: 'La sesión ya no es válida. Inicia sesión nuevamente.' });
        }

        if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
            return res.status(423).json({ error: 'Cuenta bloqueada. Contacta al administrador.' });
        }

        // Rotación: invalidar el refresh token anterior
        try {
            await addToBlacklist(oldRefreshToken);
        } catch (e) {
            if (e.code === blacklist.BLACKLIST_UNAVAILABLE) {
                return res.status(503).json({
                    error: 'Servicio de sesiones temporalmente no disponible. Intenta de nuevo en unos segundos.',
                });
            }
            throw e;
        }

        // Emitir nuevos tokens
        const newAccessToken = authService.generateAccessToken(usuario);
        const newRefreshToken = authService.generateRefreshToken(usuario);

        res.cookie('kiora_refresh_token', newRefreshToken,
            authService.cookieOptions(authService.REFRESH_COOKIE_MAX_AGE));

        logger.info('Tokens renovados', { id_usu: usuario.id_usu });
        res.status(200).json({ token: newAccessToken });
    } catch (error) {
        logger.error('Error al verificar Refresh Token', { error: error.message });
        return res.status(403).json({ error: 'Refresh Token no válido o expirado.' });
    }
};

// POST /api/auth/logout
const logout = async (req, res) => {
    try {
        await addToBlacklist(req.token);
        const refreshToken = req.cookies?.kiora_refresh_token;
        if (refreshToken) {
            await addToBlacklist(refreshToken);
        }
    } catch (e) {
        if (e.code === blacklist.BLACKLIST_UNAVAILABLE) {
            return res.status(503).json({
                error: 'No se pudo cerrar la sesión en el servidor. Intenta de nuevo en unos segundos.',
            });
        }
        logger.error('Error en logout al revocar tokens', { error: e.message });
        return res.status(500).json({ error: 'Error interno al cerrar sesión.' });
    }
    const clearOpts = authService.cookieOptions(0);
    res.clearCookie('token', clearOpts);
    res.clearCookie('kiora_refresh_token', clearOpts);
    logger.info('Sesión cerrada', { id_usu: req.usuario?.id_usu });
    res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
};

// PATCH /api/auth/users/:id/unlock
const unlockUser = async (req, res, next) => {
    const { id } = req.params;

    try {
        const result = await userRepository.unlock(id);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        logger.info('Usuario desbloqueado', { id_usu: id });
        res.status(200).json({ message: 'Usuario desbloqueado exitosamente.', usuario: result.rows[0] });

        logActivity({ user_email: req.usuario?.correo_usu, action: 'updated', entity_type: 'user', entity_id: id, details: `Usuario #${id} desbloqueado por ${req.usuario?.correo_usu}` });
    } catch (error) {
        logger.error('Error al desbloquear usuario', { error: error.message });
        next(error);
    }
};

// GET /api/auth/users (con paginación)
const getUsers = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;

        const [result, countResult] = await Promise.all([
            userRepository.findAll(limit, offset),
            userRepository.countAll(),
        ]);

        const total = parseInt(countResult.rows[0].count);

        res.status(200).json({
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error('Error al obtener usuarios', { error: error.message });
        next(error);
    }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
    try {
        const result = await userRepository.findProfile(req.usuario.id_usu);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al obtener perfil', { error: error.message });
        next(error);
    }
};

// PATCH /api/auth/users/:id — HU43
const updateUser = async (req, res, next) => {
    const { id } = req.params;

    try {
        const result = await userRepository.update(id, req.body);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        logger.info('Usuario actualizado', { id_usu: id, campos: Object.keys(req.body) });
        res.status(200).json({ message: 'Usuario actualizado exitosamente.', usuario: result.rows[0] });
    } catch (error) {
        logger.error('Error al actualizar usuario', { error: error.message });
        next(error);
    }
};

// DELETE /api/auth/users/:id — HU44
const deleteUser = async (req, res, next) => {
    const { id } = req.params;

    if (parseInt(id) === req.usuario.id_usu) {
        return res.status(403).json({ error: 'No puedes eliminar tu propio usuario.' });
    }

    try {
        const result = await userRepository.softDelete(id);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        logger.info('Usuario eliminado (soft delete)', { id_usu: id, eliminado_por: req.usuario.id_usu });
        res.status(200).json({ message: 'Usuario eliminado exitosamente.' });
    } catch (error) {
        logger.error('Error al eliminar usuario', { error: error.message });
        next(error);
    }
};

// PATCH /api/auth/users/:id/role — HU45
const updateRole = async (req, res, next) => {
    const { id } = req.params;

    if (parseInt(id) === req.usuario.id_usu) {
        return res.status(403).json({ error: 'No puedes cambiar tu propio rol.' });
    }

    try {
        const result = await userRepository.updateRole(id, req.body.rol_usu);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        logger.info('Rol actualizado', { id_usu: id, nuevo_rol: req.body.rol_usu, asignado_por: req.usuario.id_usu });
        res.status(200).json({ message: 'Rol actualizado exitosamente.', usuario: result.rows[0] });
    } catch (error) {
        logger.error('Error al actualizar rol', { error: error.message });
        next(error);
    }
};

// POST /api/auth/forgot-password — HU05
const forgotPassword = async (req, res, next) => {
    const { correo_usu } = req.body;

    try {
        const result = await userRepository.findByEmail(correo_usu);

        // Siempre responder 200 para no revelar si el correo existe (user enumeration)
        if (result.rows.length === 0) {
            return res.status(200).json({
                message: 'Si el correo está registrado, recibirás un codigo de recuperacion.'
            });
        }

        const usuario = result.rows[0];
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        const expira_en = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);

        await userRepository.invalidateActiveResetTokens(usuario.id_usu);
        await userRepository.createResetToken(usuario.id_usu, code, expira_en);

        // Publicar evento al notifications-service vía Redis pub/sub
        const emailPayload = {
            to: correo_usu,
            subject: 'Código de recuperación - Kiora',
            html: emailService.buildResetCodeHtml(code),
            text: `Tu código de recuperación es: ${code}. Expira en ${RESET_CODE_EXPIRY_MINUTES} minutos.`,
        };

        try {
            await redisClient.xadd(NOTIFICATIONS_STREAM, '*', 'payload', JSON.stringify(emailPayload));
        } catch (pubErr) {
            // Fallback: envío directo si Redis Streams falla
            logger.warn('Redis Streams no disponible, enviando email directamente', { error: pubErr.message });
            await emailService.sendPasswordResetCode(correo_usu, code);
        }

        logger.info('Email de recuperación enviado', { id_usu: usuario.id_usu });
        res.status(200).json({
            message: 'Si el correo está registrado, recibirás un codigo de recuperacion.'
        });
    } catch (error) {
        logger.error('Error en forgot-password', { error: error.message });
        next(error);
    }
};

// POST /api/auth/verify-reset-code — HU05
const verifyResetCode = async (req, res, next) => {
    const { correo_usu, code } = req.body;
    try {
        const result = await userRepository.findValidResetCodeByEmail(correo_usu, code);
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'El codigo es invalido o ha expirado.' });
        }
        return res.status(200).json({ message: 'Codigo verificado correctamente.' });
    } catch (error) {
        logger.error('Error en verify-reset-code', { error: error.message });
        next(error);
    }
};

// POST /api/auth/reset-password — HU05
const resetPassword = async (req, res, next) => {
    const { correo_usu, code, new_password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(new_password, 10);
        const outcome = await userRepository.resetPasswordWithCode(correo_usu, code, hashedPassword);

        if (!outcome.ok) {
            return res.status(400).json({ error: 'El codigo es invalido o ha expirado.' });
        }

        logger.info('Contraseña restablecida', { id_usu: outcome.id_usu });
        res.status(200).json({ message: 'Contraseña restablecida exitosamente.' });
    } catch (error) {
        logger.error('Error en reset-password', { error: error.message });
        next(error);
    }
};

// PATCH /api/auth/me/password — Cambiar contraseña (usuario autenticado)
const changePassword = async (req, res, next) => {
    const { current_password, new_password } = req.body;

    try {
        const result = await userRepository.findByIdWithPassword(req.usuario.id_usu);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const usuario = result.rows[0];
        const passwordValida = await bcrypt.compare(current_password, usuario.password_usu);

        if (!passwordValida) {
            logger.warn('Cambio de contraseña fallido: contraseña actual incorrecta', { id_usu: usuario.id_usu });
            return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await userRepository.updatePassword(usuario.id_usu, hashedPassword);

        const clearOpts = authService.cookieOptions(0);
        res.clearCookie('token', clearOpts);
        res.clearCookie('kiora_refresh_token', clearOpts);

        logger.info('Contraseña cambiada', { id_usu: usuario.id_usu });
        res.status(200).json({
            message: 'Contraseña actualizada exitosamente. Inicia sesión de nuevo en todos los dispositivos.',
        });
    } catch (error) {
        logger.error('Error en change-password', { error: error.message });
        next(error);
    }
};

// PATCH /api/auth/users/:id/password — Reset de password por Administrador
const adminResetPassword = async (req, res, next) => {
    const { id } = req.params;
    const { password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const outcome = await userRepository.updatePassword(id, hashedPassword);

        if (outcome.rows.length === 0) {
            return res.status(400).json({ error: 'Error al actualizar la contraseña. Intenta de nuevo.' });
        }

        logger.info('Admin cambió contraseña de usuario', { id_usu: id, cambiado_por: req.usuario.id_usu });
        res.status(200).json({ message: 'Contraseña actualizada exitosamente.' });
    } catch (error) {
        logger.error('Error en admin-reset-password', { error: error.message });
        next(error);
    }
};

// PATCH /api/auth/users/:id/block
const blockUser = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await userRepository.blockUser(id, 5);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        logger.info('Usuario bloqueado', { id_usu: id, bloqueado_por: req.usuario?.id_usu });
        res.status(200).json({ message: 'Usuario bloqueado exitosamente.' });

        logActivity({ user_email: req.usuario?.correo_usu, action: 'blocked', entity_type: 'user', entity_id: id, details: `Usuario #${id} bloqueado por ${req.usuario?.correo_usu}` });
    } catch (error) {
        logger.error('Error al bloquear usuario', { error: error.message });
        next(error);
    }
};

// GET /api/users/admins — devuelve correos de todos los admins (para notificaciones)
const getAdminEmails = async (_req, res, next) => {
    try {
        const result = await userRepository.findAdmins();
        const emails = result.rows.map(r => r.correo_usu);
        res.status(200).json({ emails });
    } catch (error) {
        logger.error('Error al obtener admins', { error: error.message });
        next(error);
    }
};

module.exports = {
    register,
    login,
    refresh,
    logout,
    unlockUser,
    blockUser,
    getUsers,
    getMe,
    updateUser,
    deleteUser,
    updateRole,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    changePassword,
    adminResetPassword,
    getAdminEmails,
};
