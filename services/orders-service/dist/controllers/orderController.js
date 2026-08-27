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
exports.checkProductSales = exports.getStats = exports.deleteOrder = exports.updateOrderStatus = exports.createOrder = exports.getOrderById = exports.getOrders = void 0;
const orderRepository = __importStar(require("../repositories/orderRepository"));
const orderService = __importStar(require("../services/orderService"));
const parsePagination_1 = require("../utils/parsePagination");
const logActivity_1 = require("../utils/logActivity");
const logger_1 = __importDefault(require("../config/logger"));
/**
 * orderController
 * Responsabilidad: orquestar request → service/repository → response.
 * La lógica de negocio (Saga, circuit breaker) está en orderService.
 */
// GET /api/orders — lista paginada
const getOrders = async (req, res, next) => {
    try {
        const { page, limit, offset } = (0, parsePagination_1.parsePagination)(req.query);
        const store_id = req.query.store_id ? Number(req.query.store_id) : null;
        const [rows, count] = await Promise.all([
            orderRepository.findAll({ limit, offset, store_id }),
            orderRepository.countAll(),
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
exports.getOrders = getOrders;
// GET /api/orders/:id
const getOrderById = async (req, res, next) => {
    try {
        const order = await orderRepository.findByIdWithItems(req.params.id);
        if (!order)
            return res.status(404).json({ error: 'Venta no encontrada.', code: 'NOT_FOUND' });
        res.status(200).json(order);
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.getOrderById = getOrderById;
const createOrder = async (req, res, next) => {
    const { metodopago_usu, items, descuento_global, store_id, tipo_entrega, fk_id_mesa } = req.body;
    try {
        const order = await orderService.createOrder({ metodopago_usu, items, descuento_global, store_id, tipo_entrega, fk_id_mesa });
        res.status(201).json(order);
        (0, logActivity_1.logActivity)({ user_email: req.headers['x-user-email'] || req.user?.correo_usu, user_name: req.headers['x-user-name'] || req.user?.nombre_usu || 'Desconocido', action: 'created', entity_type: 'order', entity_id: order.id_vent, details: `Venta #${order.id_vent} creada por $${order.montofinal_vent || 0}` });
    }
    catch (error) {
        if (error.status === 403 && error.code === 'BUSINESS_CLOSED') {
            return res.status(403).json({ error: error.message, code: error.code });
        }
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.createOrder = createOrder;
// PUT /api/orders/:id/status
const updateOrderStatus = async (req, res, next) => {
    const { estado } = req.body;
    const orderId = req.params.id;
    try {
        const result = await orderService.updateStatus(orderId, estado, req.headers);
        if (result.error) {
            return res.status(result.status || 500).json({
                error: result.error,
                code: result.code || 'ORDER_STATUS_ERROR',
                details: result.details,
            });
        }
        res.status(200).json(result.data);
        (0, logActivity_1.logActivity)({ user_email: req.user?.correo_usu || req.headers['x-user-email'], user_name: req.user?.nombre_usu || req.headers['x-user-name'] || 'Desconocido', action: estado === 'cancelada' ? 'deleted' : 'updated', entity_type: 'order', entity_id: orderId, details: `Venta #${orderId} → estado: ${estado}` });
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.updateOrderStatus = updateOrderStatus;
// DELETE /api/orders/:id
const deleteOrder = async (req, res, next) => {
    try {
        const result = await orderRepository.remove(req.params.id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Venta no encontrada.', code: 'NOT_FOUND' });
        }
        logger_1.default.info('Venta eliminada', { id_vent: req.params.id });
        res.status(200).json({ message: 'Venta eliminada exitosamente.' });
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.deleteOrder = deleteOrder;
// GET /api/orders/stats
const getStats = async (req, res, next) => {
    try {
        const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
        const period = req.query.period || '7d';
        const data = await orderRepository.getStats(fecha, period);
        const calcTrend = (hoy, ayer) => {
            if (ayer === 0 && hoy > 0)
                return 100;
            if (ayer === 0 && hoy === 0)
                return 0;
            return ((hoy - ayer) / ayer) * 100;
        };
        const trendMonto = calcTrend(Number(data.hoy.monto_total), Number(data.ayer.monto_total));
        const trendTicket = calcTrend(Number(data.hoy.ticket_promedio), Number(data.ayer.ticket_promedio));
        res.status(200).json({
            fecha,
            ventas_hoy: Number(data.hoy.total_ventas),
            monto_total: Number(data.hoy.monto_total).toFixed(2),
            ticket_promedio: Number(data.hoy.ticket_promedio).toFixed(2),
            ultima_venta: data.hoy.ultima_venta || null,
            ventas_ayer: Number(data.ayer.total_ventas),
            monto_total_ayer: Number(data.ayer.monto_total).toFixed(2),
            ticket_promedio_ayer: Number(data.ayer.ticket_promedio).toFixed(2),
            trend_monto: trendMonto,
            trend_ticket: trendTicket,
            pagos_efectivo: data.pagos.pagos_efectivo,
            pagos_tarjeta: data.pagos.pagos_tarjeta,
            evolucion_ventas: data.evolucion
        });
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.getStats = getStats;
// GET /api/orders/products/:id/has-sales
const checkProductSales = async (req, res, next) => {
    try {
        const { id } = req.params;
        const exists = await orderRepository.checkProductInSales(id);
        res.status(200).json({ hasSales: exists });
    }
    catch (error) {
        logger_1.default.error('error', { error: error.message });
        next(error);
    }
};
exports.checkProductSales = checkProductSales;
