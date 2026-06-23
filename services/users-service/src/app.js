const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const pool = require('./config/db');
const blacklist = require('./config/blacklist');
const logger = require('./config/logger');
const authRoutes = require('./routes/authRoutes');
const incidentsRoutes = require('./routes/incidentsRoutes');
const errorHandler = require('./middleware/errorHandler');

/**
 * app.js
 * Configuración de Express separada del arranque del servidor.
 * Importado tanto por index.js (servidor real) como por los tests.
 */
const app = express();

// ── Seguridad ──────────────────────────────────────────────────────────────
app.use(helmet());  // Agrega cabeceras de seguridad HTTP automáticamente

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-type'],
    credentials: true,
}));

// ── Parsers ────────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json());

// ── Correlation ID (AsyncLocalStorage) — DEBE IR ANTES de cualquier ruta ──
const correlationMiddleware = require('./middleware/correlationMiddleware');
app.use(correlationMiddleware);

// ── Health check (liveness: proceso vivo) ─────────────────────────────────
app.get('/api/users/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Users Service Kiora está corriendo' });
});

// ── Readiness (dependencias: Postgres + Redis) ─────────────────────────────
app.get('/api/users/ready', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        await blacklist.ping();
        res.status(200).json({
            status: 'ready',
            checks: { postgres: true, redis: true },
        });
    } catch (err) {
        logger.warn('Readiness check falló', { error: err.message });
        res.status(503).json({
            status: 'not_ready',
            error: 'Una o más dependencias no responden.',
        });
    }
});

// ── Documentación Swagger ──────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/users/docs-json', (req, res) => res.json(swaggerSpec));

const settingsRoutes = require('./routes/settingsRoutes');

// ── Rutas ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/settings', settingsRoutes);

// ── Manejo centralizado de errores (SIEMPRE al final) ──────────────────────
app.use(errorHandler);

module.exports = app;
