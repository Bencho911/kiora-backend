'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * asyncContext.js — Contexto asíncrono global (AsyncLocalStorage)
 *
 * Permite almacenar datos por request (ej: correlationId) sin
 * necesidad de pasarlos manualmente a través de toda la pila de llamadas.
 * Winston lo consulta automáticamente para inyectar el correlationId en cada log.
 *
 * Uso:
 *   const store = asyncContext.getStore();
 *   const correlationId = store?.get('correlationId');
 */
const async_hooks_1 = require("async_hooks");
const asyncContext = new async_hooks_1.AsyncLocalStorage();
exports.default = asyncContext;
