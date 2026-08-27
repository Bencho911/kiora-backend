"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncContext = void 0;
const async_hooks_1 = require("async_hooks");
exports.asyncContext = new async_hooks_1.AsyncLocalStorage();
