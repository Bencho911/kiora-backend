/**
 * auth.js
 * Middleware de Autenticación Centralizada para el API Gateway.
 *
 * ─ Fail-fast: el Gateway NO arranca si JWT_SECRET no está definida.
 * ─ Rutas públicas inteligentes: usa prefijos en vez de lista estática.
 * ─ Soporte para KIOSK_API_KEY: permite a los Kioscos acceder saltándose JWT.
 * ─ Inyecta x-user-id y x-user-role para que los microservicios
 *   downstream los lean sin re-verificar el JWT.
 */
const jwt = require('jsonwebtoken');

// ── Fail-fast: jamás arrancar sin secreto ─────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error(
        '❌ JWT_SECRET no está definida. El API Gateway NO puede arrancar de forma segura.\n' +
        '   Configúrala en .env.docker o .env.local.'
    );
    process.exit(1);
}

// ── Variables Globales ──────────────────────────────────────────────────
const KIOSK_API_KEY = process.env.KIOSK_API_KEY; // Opcional, pero recomendada.

// ── Prefijos / rutas que NO requieren JWT ni Token ───────────────────────
const PUBLIC_PREFIXES = [
    '/health',
    '/metrics',
    '/api/docs',            // Swagger UI (HTML, JS, CSS)
    '/api/docs.json',       // Specs JSON proxy de products/inventory/orders
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-reset-code',
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/verify-reset-code',
    '/api/public/',         // Catálogo público del kiosco (sin auth)
    '/api/users/health',
    '/api/users/ready',
    '/api/users/docs-json',
    '/api/v1/users/health',
    '/api/v1/users/ready',
    '/api/orders/checkout/webhook', // Webhooks de Stripe (externo)
    '/uploads',             // Imágenes de productos (acceso público)
];

// Rutas GET públicas por path exacto (método + path específico)
const PUBLIC_GET_ROUTES = [
    '/api/ai/business-state',
];

const isPublicRoute = (req) => {
    const { path, method } = req;
    if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
    if (method === 'GET' && PUBLIC_GET_ROUTES.includes(path)) return true;
    return false;
};

// ── Middleware ─────────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
    // 1. Verificar si es ruta pública
    if (isPublicRoute(req)) {
        return next();
    }

    // 2. Verificar si es petición de Kiosco (Machine-to-Machine API Key)
    const apiKeyHeader = req.headers['x-api-key'];
    if (KIOSK_API_KEY && apiKeyHeader === KIOSK_API_KEY) {
        // Inyectamos el ID del usuario kiosco para trazabilidad downstream
        const kioskUserId = process.env.KIOSKO_USER_ID || '1';
        req.headers['x-user-id'] = kioskUserId;
        req.headers['x-user-role'] = 'kiosco';
        return next();
    }

    // 3. Buscar el token en headers (Bearer) o cookies (Usuarios regulares)
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'No se proporcionó token de autenticación. Acceso denegado por el API Gateway.',
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Inyectar claims reales del JWT del users-service
        req.headers['x-user-id'] = String(decoded.id_usu);
        if (decoded.rol_usu) {
            req.headers['x-user-role'] = decoded.rol_usu;
        }

        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token de autenticación inválido o expirado.',
            details: error.message,
        });
    }
};

module.exports = authMiddleware;
