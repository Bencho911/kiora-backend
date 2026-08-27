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
exports.createInvoice = exports.getInvoiceById = exports.getInvoices = void 0;
const invoiceRepository = __importStar(require("../repositories/invoiceRepository"));
const orderRepository = __importStar(require("../repositories/orderRepository"));
const logger_1 = __importDefault(require("../config/logger"));
// GET /api/orders/invoices
const getInvoices = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const offset = (page - 1) * limit;
        const [rows, count] = await Promise.all([
            invoiceRepository.findAll({ limit, offset }),
            invoiceRepository.countAll(),
        ]);
        res.status(200).json({
            data: rows.rows,
            pagination: {
                total: parseInt(count.rows[0].count, 10),
                page,
                limit,
                totalPages: Math.ceil(count.rows[0].count / limit),
            }
        });
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.getInvoices = getInvoices;
// GET /api/orders/invoices/:id
const getInvoiceById = async (req, res, next) => {
    try {
        const result = await invoiceRepository.findById(req.params.id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada.' });
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.getInvoiceById = getInvoiceById;
// POST /api/orders/invoices
const createInvoice = async (req, res, next) => {
    const { fk_id_vent, id_usu, cantidad_vent, precio_prod, montototal_vent } = req.body;
    if (!fk_id_vent || !id_usu || !cantidad_vent || precio_prod === undefined || !montototal_vent) {
        return res.status(400).json({
            error: 'fk_id_vent, id_usu, cantidad_vent, precio_prod y montototal_vent son obligatorios.',
        });
    }
    if (Number(cantidad_vent) <= 0 || Number(precio_prod) < 0 || Number(montototal_vent) < 0) {
        return res.status(400).json({ error: 'Valores numéricos inválidos.' });
    }
    // Verificar que la venta exista
    const ventaRes = await orderRepository.findById(fk_id_vent);
    if (ventaRes.rows.length === 0) {
        return res.status(404).json({ error: `Venta ${fk_id_vent} no encontrada.` });
    }
    // Evitar facturas duplicadas por venta
    const existing = await invoiceRepository.findByVenta(fk_id_vent);
    if (existing.rows.length > 0) {
        return res.status(409).json({ error: `La venta ${fk_id_vent} ya tiene una factura emitida.` });
    }
    try {
        const result = await invoiceRepository.create({
            fk_id_vent, id_usu, cantidad_vent, precio_prod, montototal_vent,
        });
        logger_1.default.info('Factura emitida', { factura_id: result.rows[0].id, fk_id_vent });
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.createInvoice = createInvoice;
