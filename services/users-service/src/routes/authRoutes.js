const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { loginSchema, registerSchema, updateUserSchema, updateRoleSchema, forgotPasswordSchema, verifyResetCodeSchema, resetPasswordSchema, changePasswordSchema } = require('../validators/authValidators');
const {
    register, login, refresh, logout, unlockUser, getUsers, getMe,
    updateUser, deleteUser, updateRole, forgotPassword, verifyResetCode, resetPassword, changePassword,
    adminResetPassword
} = require('../controllers/authController');

const isTestEnv = process.env.NODE_ENV === 'test';
const createLimiter = (windowMs, max, message) =>
    rateLimit({
        windowMs,
        max: isTestEnv ? 10000 : max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
    });

const loginLimiter = createLimiter(
    15 * 60 * 1000,
    10,
    'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'
);
const forgotPasswordLimiter = createLimiter(
    15 * 60 * 1000,
    5,
    'Demasiadas solicitudes de recuperación. Intenta de nuevo en 15 minutos.'
);
const verifyResetCodeLimiter = createLimiter(
    10 * 60 * 1000,
    10,
    'Demasiados intentos de verificación de código. Intenta de nuevo en 10 minutos.'
);
const resetPasswordLimiter = createLimiter(
    10 * 60 * 1000,
    5,
    'Demasiados intentos de restablecimiento. Intenta de nuevo en 10 minutos.'
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [correo_usu, password]
 *             properties:
 *               correo_usu:
 *                 type: string
 *                 example: admin@kiora.com
 *               password:
 *                 type: string
 *                 example: mipassword
 *     responses:
 *       200:
 *         description: Login exitoso. Devuelve token (móvil) o cookie (web).
 *       400:
 *         description: Campos obligatorios faltantes.
 *       401:
 *         description: Credenciales incorrectas.
 *       423:
 *         description: Cuenta bloqueada.
 */
router.post('/login', loginLimiter, validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario (solo admin)
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom_usu, correo_usu, password]
 *             properties:
 *               nom_usu:
 *                 type: string
 *               correo_usu:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: "Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&_#^-.)"
 *                 example: "MiPass1!"
 *               rol_usu:
 *                 type: string
 *                 enum: [admin, cliente]
 *               tel_usu:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente.
 *       400:
 *         description: Datos inválidos.
 *       401:
 *         description: Token no proporcionado.
 *       403:
 *         description: No es administrador.
 *       409:
 *         description: Correo ya registrado.
 *       503:
 *         description: Redis no disponible al validar blacklist del access token (BLACKLIST_FAIL_OPEN=false).
 */
router.post('/register', verifyToken, isAdmin, validate(registerSchema), register);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renovar Access Token usando Refresh Token (cookie)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Nuevo access token en body; nueva cookie de refresh emitida.
 *       401:
 *         description: Sin cookie de refresh, refresh revocado, usuario inválido, sesión obsoleta (claim sv), etc.
 *       403:
 *         description: Refresh JWT inválido o expirado.
 *       423:
 *         description: Cuenta bloqueada.
 *       503:
 *         description: Redis no disponible al comprobar/guardar revocación (BLACKLIST_FAIL_OPEN=false).
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada; access y refresh revocados en Redis.
 *       401:
 *         description: Token no proporcionado o inválido.
 *       503:
 *         description: No se pudo revocar en Redis (BLACKLIST_FAIL_OPEN=false).
 */
router.post('/logout', verifyToken, logout);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Obtener todos los usuarios (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Cantidad de resultados por página
 *     responses:
 *       200:
 *         description: Lista paginada de usuarios.
 *       401:
 *         description: Token no proporcionado.
 *       403:
 *         description: No es administrador.
 *       503:
 *         description: Redis no disponible (BLACKLIST_FAIL_OPEN=false).
 */
router.get('/users', verifyToken, isAdmin, getUsers);

/**
 * @swagger
 * /api/auth/users/{id}/unlock:
 *   patch:
 *     summary: Desbloquear usuario (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario desbloqueado.
 *       404:
 *         description: Usuario no encontrado.
 *       503:
 *         description: Redis no disponible (BLACKLIST_FAIL_OPEN=false).
 */
router.patch('/users/:id/unlock', verifyToken, isAdmin, unlockUser);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del usuario autenticado.
 *       401:
 *         description: Sin token, expirado, sesión revocada, claim sv desincronizado o usuario inactivo.
 *       404:
 *         description: Perfil no encontrado (caso excepcional).
 *       503:
 *         description: Redis no disponible al comprobar blacklist (BLACKLIST_FAIL_OPEN=false).
 */
router.get('/me', verifyToken, getMe);

/**
 * @swagger
 * /api/auth/users/{id}/role:
 *   patch:
 *     summary: Asignar rol a un usuario (solo admin) — HU45
 *     tags: [Usuarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rol_usu]
 *             properties:
 *               rol_usu:
 *                 type: string
 *                 enum: [admin, cliente]
 *     responses:
 *       200:
 *         description: Rol actualizado exitosamente.
 *       400:
 *         description: Rol inválido.
 *       403:
 *         description: No puedes cambiar tu propio rol.
 *       404:
 *         description: Usuario no encontrado.
 *       503:
 *         description: Redis no disponible (BLACKLIST_FAIL_OPEN=false).
 */
router.patch('/users/:id/role', verifyToken, isAdmin, validate(updateRoleSchema), updateRole);

/**
 * @swagger
 * /api/auth/users/{id}:
 *   patch:
 *     summary: Actualizar datos de un usuario (solo admin) — HU43
 *     tags: [Usuarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom_usu:
 *                 type: string
 *               correo_usu:
 *                 type: string
 *               tel_usu:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente.
 *       400:
 *         description: Ningún campo enviado para actualizar.
 *       404:
 *         description: Usuario no encontrado.
 *       503:
 *         description: Redis no disponible (BLACKLIST_FAIL_OPEN=false).
 */
router.patch('/users/:id', verifyToken, isAdmin, validate(updateUserSchema), updateUser);

/**
 * @swagger
 * /api/auth/users/{id}:
 *   delete:
 *     summary: Eliminar usuario (soft delete, solo admin) — HU44
 *     tags: [Usuarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente.
 *       403:
 *         description: No puedes eliminar tu propio usuario.
 *       404:
 *         description: Usuario no encontrado.
 *       503:
 *         description: Redis no disponible (BLACKLIST_FAIL_OPEN=false).
 */
router.delete('/users/:id', verifyToken, isAdmin, deleteUser);

/**
 * @swagger
 * /api/auth/users/{id}/password:
 *   patch:
 *     summary: Restablecer contraseña de un usuario (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada exitosamente.
 *       403:
 *         description: No es administrador.
 *       404:
 *         description: Usuario no encontrado.
 */
router.patch('/users/:id/password', verifyToken, isAdmin, adminResetPassword);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar recuperación de contraseña — HU05
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [correo_usu]
 *             properties:
 *               correo_usu:
 *                 type: string
 *                 example: usuario@kiora.com
 *     responses:
 *       200:
 *         description: Siempre responde 200 (no revela si el correo existe).
 *       400:
 *         description: Correo inválido.
 *       429:
 *         description: Demasiadas solicitudes de recuperación en la ventana de tiempo.
 */
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña con código OTP — HU05
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [correo_usu, code, new_password]
 *             properties:
 *               correo_usu:
 *                 type: string
 *                 example: usuario@kiora.com
 *               code:
 *                 type: string
 *                 pattern: '^\d{6}$'
 *                 example: '123456'
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *                 description: "Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&_#^-.)"
 *     responses:
 *       200:
 *         description: Contraseña restablecida; session_version incrementada — todas las sesiones anteriores quedan inválidas.
 *       400:
 *         description: Código inválido, expirado o campos faltantes.
 *       429:
 *         description: Demasiados intentos de restablecimiento en la ventana de tiempo.
 */
router.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), resetPassword);

/**
 * @swagger
 * /api/auth/verify-reset-code:
 *   post:
 *     summary: Verificar código de recuperación (OTP)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [correo_usu, code]
 *             properties:
 *               correo_usu:
 *                 type: string
 *               code:
 *                 type: string
 *                 pattern: '^\\d{6}$'
 *     responses:
 *       200:
 *         description: Código válido.
 *       400:
 *         description: Código inválido o expirado.
 *       429:
 *         description: Demasiados intentos de verificación de código en la ventana de tiempo.
 */
router.post('/verify-reset-code', verifyResetCodeLimiter, validate(verifyResetCodeSchema), verifyResetCode);

/**
 * @swagger
 * /api/auth/me/password:
 *   patch:
 *     summary: Cambiar contraseña del usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password:
 *                 type: string
 *                 description: Contraseña actual del usuario
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *                 description: "Nueva contraseña fuerte (mín. 8 caracteres, mayúscula, minúscula, número y carácter especial). Debe ser distinta a la actual."
 *     responses:
 *       200:
 *         description: Contraseña actualizada; session_version incrementada — debe iniciar sesión de nuevo (cookies de sesión limpiadas).
 *       400:
 *         description: Campos inválidos o nueva igual a la actual.
 *       401:
 *         description: Token no proporcionado, inválido o contraseña actual incorrecta.
 *       404:
 *         description: Usuario no encontrado.
 *       503:
 *         description: Redis no disponible (BLACKLIST_FAIL_OPEN=false).
 */
router.patch('/me/password', verifyToken, validate(changePasswordSchema), changePassword);

module.exports = router;
