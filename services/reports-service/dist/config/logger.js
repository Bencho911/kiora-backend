'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = require("winston");
const asyncContext_js_1 = __importDefault(require("../utils/asyncContext.js"));
const SERVICE_NAME = process.env.SERVICE_NAME || 'reports-service';
// Custom format: inyecta correlationId desde AsyncLocalStorage
const correlationFormat = (0, winston_1.format)((info) => {
    const store = asyncContext_js_1.default.getStore();
    if (store) {
        info.correlationId = store.get('correlationId');
    }
    info.service = SERVICE_NAME;
    return info;
});
const logger = (0, winston_1.createLogger)({
    level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    format: winston_1.format.combine(correlationFormat(), winston_1.format.timestamp(), winston_1.format.json()),
    transports: [new winston_1.transports.Console()],
});
exports.default = logger;
