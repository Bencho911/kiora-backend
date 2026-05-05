require('./config/tracing');
const logger = require('./config/logger');
const app = require('./app');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    logger.info(`API Gateway iniciado en puerto ${PORT}`);
    logger.info(`Swagger UI: http://localhost:${PORT}/api/docs`);
});

// ── Socket.IO para dashboard en tiempo real ───────────────────────────────
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
});

io.on('connection', (socket) => {
    logger.info('Dashboard WebSocket conectado', { id: socket.id });
    socket.on('disconnect', () => {
        logger.info('Dashboard WebSocket desconectado', { id: socket.id });
    });
});

// Exponer io para que otros módulos emitan eventos
app.locals.io = io;

logger.info('WebSocket (Socket.IO) listo para conexiones de dashboard');

// ── Graceful shutdown ─────────────────────────────────────────────────────
function shutdown(signal) {
    logger.info(`${signal} recibido — cerrando Gateway gracefully...`);
    io.close();
    server.close(() => {
        logger.info('Gateway cerrado correctamente');
        process.exit(0);
    });
    // Forzar cierre si no termina en 10s
    setTimeout(() => {
        logger.error('Forzando cierre tras 10s');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

