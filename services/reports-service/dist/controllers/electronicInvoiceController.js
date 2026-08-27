'use strict';
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
exports.cancelElectronicInvoice = exports.generateElectronicInvoice = void 0;
const factusService = __importStar(require("../services/factusService.js"));
const env_js_1 = __importDefault(require("../config/env.js"));
const logger_js_1 = __importDefault(require("../config/logger.js"));
/**
 * electronicInvoiceController
 * Emite una factura electronica real via Factus API o simulada si no esta configurado.
 */
const generateElectronicInvoice = async (req, res, next) => {
    try {
        const { id_vent } = req.params;
        // 1. Obtener la orden real desde orders-service
        const orderRes = await fetch(`${env_js_1.default.ordersServiceUrl}/api/orders/${id_vent}`);
        if (!orderRes.ok) {
            if (orderRes.status === 404) {
                return res.status(404).json({ error: 'Venta no encontrada.' });
            }
            return res.status(orderRes.status).json({ error: 'Error al obtener datos de la venta.' });
        }
        const order = await orderRes.json();
        if (!order || !order.id_vent) {
            return res.status(404).json({ error: 'Venta no encontrada.' });
        }
        // 2. Emitir factura via Factus (o simulada si no configurado)
        const invoiceResult = await factusService.createInvoice(order);
        logger_js_1.default.info('Factura electronica generada', {
            id_vent,
            factus: invoiceResult.status || 'ok',
        });
        res.status(200).json(invoiceResult);
    }
    catch (error) {
        logger_js_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.generateElectronicInvoice = generateElectronicInvoice;
/**
 * Anula una factura electronica en Factus.
 * La orden se cancela en Kiora independientemente del resultado de Factus.
 */
const cancelElectronicInvoice = async (req, res, next) => {
    try {
        const { id_vent } = req.params;
        const { reference_code } = req.body;
        if (!reference_code) {
            return res.status(400).json({ error: 'reference_code es requerido.' });
        }
        const result = await factusService.deleteInvoice(reference_code);
        logger_js_1.default.info('Anulacion de factura electronica', {
            id_vent,
            reference_code,
            factus_status: result.status,
        });
        res.status(200).json(result);
    }
    catch (error) {
        logger_js_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.cancelElectronicInvoice = cancelElectronicInvoice;
