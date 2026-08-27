"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWompiWebhook = exports.generateCheckoutParams = void 0;
const wompiService = __importStar(require("../services/wompiService"));
const orderService = __importStar(require("../services/orderService"));
const orderRepository = __importStar(require("../repositories/orderRepository"));
const logger_1 = __importDefault(require("../config/logger"));
const httpClient_1 = require("../utils/httpClient");
const generateCheckoutParams = async (req, res) => {
    const { id } = req.params;
    const { redirect_url } = req.body || {};
    try {
        const orden = await orderRepository.findByIdWithItems(id);
        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada.' });
        }
        if (orden.estado === 'pagado' || orden.estado === 'completada') {
            return res.status(400).json({ error: 'La orden ya está pagada o completada.' });
        }
        // ── LLAMADA SÍNCRONA: Validar stock antes de cobrar ──
        // Se mantiene síncrona intencionalmente: es mejor decirle al cliente
        // "no hay stock" ANTES de cobrarle, que cobrar y reembolsar después.
        const headers = (0, httpClient_1.outgoingHeaders)(req.headers);
        let reserveRes;
        try {
            reserveRes = await (0, httpClient_1.fetchWithRetry)(process.env.INVENTORY_SERVICE_URL + '/api/inventory/saga/reserve', {
                method: 'POST',
                headers,
                body: JSON.stringify({ orderId: orden.id_vent, items: orden.items }),
            }, {
                maxRetries: 1,
                timeoutMs: httpClient_1.DEFAULT_TIMEOUT_MS,
                onNonRetryable: (status) => status >= 400 && status < 500,
            });
        }
        catch (inventoryErr) {
            logger_1.default.error('Error de conectividad con inventory-service al reservar', {
                orderId: id, error: inventoryErr.message, code: inventoryErr.code,
            });
            return res.status(503).json({
                error: 'No se pudo validar el inventario. Intenta de nuevo en unos segundos.',
                detail: inventoryErr.message,
            });
        }
        if (!reserveRes.ok) {
            const errData = await reserveRes.json().catch(() => ({}));
            return res.status(409).json({ error: errData.error || 'Agotado o fallo reservando inventario temporalmente' });
        }
        let checkoutUrl;
        try {
            const result = await wompiService.createCheckoutUrl(orden, redirect_url || null);
            checkoutUrl = result.checkoutUrl;
        }
        catch (wompiErr) {
            logger_1.default.error('Error creando URL de checkout Wompi', {
                orderId: id, error: wompiErr.message,
            });
            return res.status(502).json({
                error: 'Error al generar el enlace de pago con Wompi.',
                detail: wompiErr.message,
            });
        }
        res.status(200).json({
            status: 'ok',
            checkoutUrl,
        });
    }
    catch (error) {
        logger_1.default.error('Error generando link de pago Checkout', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Error interno generando link de pago.', detail: error.message });
    }
};
exports.generateCheckoutParams = generateCheckoutParams;
const handleWompiWebhook = async (req, res) => {
    const body = req.body;
    // Verificar firma del webhook
    try {
        wompiService.verifyWebhookSignature(body);
    }
    catch (err) {
        logger_1.default.error('Webhook Wompi: firma inválida', { detail: err.message });
        return res.status(401).json({ error: 'Webhook Error: ' + err.message });
    }
    const event = body.event;
    const transaction = body.data?.transaction;
    if (event === 'transaction.updated' && transaction?.status === 'APPROVED') {
        const reference = transaction.reference;
        const orderId = wompiService.extractOrderIdFromReference(reference);
        if (!orderId) {
            logger_1.default.warn('Wompi Webhook: referencia sin orderId reconocible', { reference });
            return res.json({ received: true });
        }
        const transactionId = transaction.id;
        logger_1.default.info('Wompi Webhook: Transacción aprobada', { orderId, transactionId, reference });
        try {
            // completeOrder en una sola transacción atómica:
            //   a) Cambia estado a 'completada' (+ guarda transactionId)
            //   b) Crea la factura
            //   c) Inserta eventos outbox de movimiento de inventario
            //   d) Inserta evento outbox para facturación electrónica (Factus/DIAN)
            //   e) Envía broadcast WebSocket al dashboard
            const result = await orderService.completeOrder(orderId, req.headers, transactionId);
            if (!result.ok) {
                logger_1.default.error('Error completando orden desde webhook Wompi', {
                    orderId, error: result.error, code: result.code,
                });
                return res.status(result.status || 500).json({ error: result.error || 'Error completando la orden.' });
            }
        }
        catch (err) {
            logger_1.default.error('Error CRÍTICO en webhook Wompi — excepción no capturada en completeOrder', {
                orderId, error: err.message, stack: err.stack,
            });
            return res.status(500).json({ error: 'Error interno procesando el webhook.' });
        }
    }
    res.json({ received: true });
};
exports.handleWompiWebhook = handleWompiWebhook;
