"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const asyncContext_1 = __importDefault(require("../utils/asyncContext"));
const correlationMiddleware = (req, _res, next) => {
    const correlationId = req.headers['x-correlation-id'] || crypto_1.default.randomUUID();
    const store = new Map([['correlationId', correlationId]]);
    asyncContext_1.default.run(store, () => next());
};
exports.default = correlationMiddleware;
