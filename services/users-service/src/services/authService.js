const jwt = require('jsonwebtoken');
const blacklist = require('../config/blacklist');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ── Fail-fast: access y refresh DEBEN usar secretos distintos ─────────────
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_REFRESH_SECRET) {
    console.error(
        '❌ JWT_REFRESH_SECRET no está definida. El servicio NO puede arrancar de forma segura.\n' +
        '   Configúrala en .env.docker o .env.local.'
    );
    process.exit(1);
}

if (JWT_REFRESH_SECRET === JWT_SECRET) {
    console.error(
        '❌ JWT_REFRESH_SECRET es idéntica a JWT_SECRET. Deben ser valores distintos.\n' +
        '   Un access token robado podría usarse como refresh token si comparten secreto.'
    );
    process.exit(1);
}

const tokenSv = (usuario) =>
    usuario.session_version !== undefined && usuario.session_version !== null
        ? usuario.session_version
        : 0;

const generateAccessToken = (usuario) =>
    jwt.sign(
        {
            id_usu: usuario.id_usu,
            correo_usu: usuario.correo_usu,
            rol_usu: usuario.rol_usu,
            sv: tokenSv(usuario),
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

const generateRefreshToken = (usuario) =>
    jwt.sign(
        {
            id_usu: usuario.id_usu,
            correo_usu: usuario.correo_usu,
            rol_usu: usuario.rol_usu,
            sv: tokenSv(usuario),
        },
        JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

const verifyRefreshToken = (token) =>
    jwt.verify(token, JWT_REFRESH_SECRET);

const isTokenRevoked = async (token) => blacklist.has(token);

const cookieOptions = (maxAgeMs) => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: maxAgeMs,
});

const ACCESS_COOKIE_MAX_AGE = 10 * 60 * 1000;       // 10 minutos
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 días

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    isTokenRevoked,
    cookieOptions,
    ACCESS_COOKIE_MAX_AGE,
    REFRESH_COOKIE_MAX_AGE,
};
