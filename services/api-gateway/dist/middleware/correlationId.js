"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationId = void 0;
const crypto_1 = __importDefault(require("crypto"));
const asyncContext_1 = require("../utils/asyncContext");
const correlationId = (req, res, next) => {
    const id = req.headers['x-correlation-id'] ||
        req.headers['x-request-id'] ||
        crypto_1.default.randomUUID();
    req.headers['x-correlation-id'] = id;
    res.setHeader('x-correlation-id', id);
    // Envolver el request en AsyncLocalStorage para que Winston lo lea
    const store = new Map([['correlationId', id]]);
    asyncContext_1.asyncContext.run(store, () => next());
};
exports.correlationId = correlationId;
