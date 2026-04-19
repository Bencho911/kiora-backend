require('./config/tracing');
const logger = require('./config/logger');
const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    logger.info(`API Gateway iniciado en puerto ${PORT}`);
    logger.info(`Swagger UI: http://localhost:${PORT}/api/docs`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
function shutdown(signal) {
    logger.info(`${signal} recibido — cerrando Gateway gracefully...`);
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
