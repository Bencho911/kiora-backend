const jwt = require('jsonwebtoken');
const blacklist = require('../config/blacklist');
const userRepository = require('../repositories/userRepository');

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no está definido en las variables de entorno. La aplicación no puede iniciar de forma segura.');
}

const addToBlacklist = (token) => blacklist.add(token);

const verifyToken = async (req, res, next) => {
    // 1. Intentar leer de la cookie HttpOnly (clientes web)
    let token = req.cookies?.token;

    // 2. Si no hay cookie, leer del header Authorization (clientes móviles)
    if (!token) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    // HU02 – Rechazar tokens revocados (logout)
    let isRevoked = false;
    try {
        isRevoked = await blacklist.has(token);
    } catch (e) {
        if (e.code === blacklist.BLACKLIST_UNAVAILABLE) {
            return res.status(503).json({
                error: 'Servicio de sesiones temporalmente no disponible. Intenta de nuevo en unos segundos.',
            });
        }
        throw e;
    }
    if (isRevoked) {
        return res.status(401).json({ error: 'La sesión ha sido cerrada. Inicia sesión nuevamente.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const tokenSv = decoded.sv !== undefined && decoded.sv !== null ? decoded.sv : 0;
        const svResult = await userRepository.getSessionVersion(decoded.id_usu);
        if (svResult.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no válido. Inicia sesión nuevamente.' });
        }
        const currentSv = svResult.rows[0].session_version;
        if (currentSv !== tokenSv) {
            return res.status(401).json({ error: 'La sesión ya no es válida. Inicia sesión nuevamente.' });
        }
        req.usuario = decoded; // { id_usu, correo_usu, rol_usu, sv }
        req.token = token;     // guardar para el logout
        next();
    } catch (error) {
        // HU03 – Distinguir token expirado vs inválido
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'La sesión ha expirado. Inicia sesión nuevamente.' });
        }
        return res.status(403).json({ error: 'Token inválido.' });
    }
};

const isAdmin = (req, res, next) => {
    if (!req.usuario || req.usuario.rol_usu !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo el administrador puede realizar esta acción.' });
    }
    next();
};

module.exports = { verifyToken, isAdmin, addToBlacklist };
