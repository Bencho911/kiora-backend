'use strict';

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
const { AsyncLocalStorage } = require('async_hooks');

const asyncContext = new AsyncLocalStorage();

module.exports = asyncContext;
