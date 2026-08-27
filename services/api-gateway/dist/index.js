"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/tracing");
const logger_1 = __importDefault(require("./config/logger"));
const app_1 = __importDefault(require("./app"));
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const PORT = process.env.PORT || 3000;
const server = (0, http_1.createServer)(app_1.default);
server.listen(PORT, () => {
    logger_1.default.info(`API Gateway iniciado en puerto ${PORT}`);
    logger_1.default.info(`Swagger UI: http://localhost:${PORT}/api/docs`);
});
// ── Socket.IO para dashboard en tiempo real ───────────────────────────────
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
});
io.on('connection', (socket) => {
    logger_1.default.info('Dashboard WebSocket conectado', { id: socket.id });
    socket.on('disconnect', () => {
        logger_1.default.info('Dashboard WebSocket desconectado', { id: socket.id });
    });
});
// Exponer io para que otros módulos emitan eventos
app_1.default.locals.io = io;
logger_1.default.info('WebSocket (Socket.IO) listo para conexiones de dashboard');
// ── Graceful shutdown ─────────────────────────────────────────────────────
function shutdown(signal) {
    logger_1.default.info(`${signal} recibido — cerrando Gateway gracefully...`);
    io.close();
    server.close(() => {
        logger_1.default.info('Gateway cerrado correctamente');
        process.exit(0);
    });
    // Forzar cierre si no termina en 10s
    setTimeout(() => {
        logger_1.default.error('Forzando cierre tras 10s');
        process.exit(1);
    }, 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
