"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const activityLog_js_1 = __importDefault(require("./routes/activityLog.js"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(express_1.default.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/activity-logs', activityLog_js_1.default);
app.use((err, _req, res, _next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
});
const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
    console.log(`Activity Service running on port ${PORT}`);
});
