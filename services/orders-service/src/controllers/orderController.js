'use strict';

const orderRepository = require('../repositories/orderRepository');
const orderService = require('../services/orderService');
const parsePagination = require('../utils/parsePagination');
const logActivity = require('../utils/logActivity');
const logger = require('../config/logger');

/**
 * orderController
 * Responsabilidad: orquestar request → service/repository → response.
 * La lógica de negocio (Saga, circuit breaker) está en orderService.
 */

// GET /api/orders — lista paginada
const getOrders = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const [rows, count] = await Promise.all([
            orderRepository.findAll({ limit, offset }),
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
    } catch (error) {
        logger.error('Error al listar ventas', { error: error.message });
        next(error);
    }
};

// GET /api/orders/:id
const getOrderById = async (req, res, next) => {
    try {
        const order = await orderRepository.findByIdWithItems(req.params.id);
        if (!order) return res.status(404).json({ error: 'Venta no encontrada.', code: 'NOT_FOUND' });
        res.status(200).json(order);
    } catch (error) {
        logger.error('Error al obtener venta', { error: error.message });
        next(error);
    }
};

const createOrder = async (req, res, next) => {
    const { metodopago_usu, items } = req.body;

    try {
        const order = await orderService.createOrder({ metodopago_usu, items });
        res.status(201).json(order);

        logActivity({ user_email: req.headers['x-user-email'] || req.user?.correo_usu, action: 'created', entity_type: 'order', entity_id: order.id_vent, details: `Venta #${order.id_vent} creada por $${order.montofinal_vent || 0}` });
    } catch (error) {
        if (error.status === 403 && error.code === 'BUSINESS_CLOSED') {
            return res.status(403).json({ error: error.message, code: error.code });
        }
        logger.error('Error al crear venta', { error: error.message });
        next(error);
    }
};

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

        logActivity({ user_email: req.user?.correo_usu, action: estado === 'cancelada' ? 'deleted' : 'updated', entity_type: 'order', entity_id: orderId, details: `Venta #${orderId} → estado: ${estado}` });
    } catch (error) {
        logger.error('Error al actualizar estado', { error: error.message });
        next(error);
    }
};

// DELETE /api/orders/:id
const deleteOrder = async (req, res, next) => {
    try {
        const result = await orderRepository.remove(req.params.id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Venta no encontrada.', code: 'NOT_FOUND' });
        }
        logger.info('Venta eliminada', { id_vent: req.params.id });
        res.status(200).json({ message: 'Venta eliminada exitosamente.' });
    } catch (error) {
        logger.error('Error al eliminar venta', { error: error.message });
        next(error);
    }
};

// GET /api/orders/stats
const getStats = async (req, res, next) => {
    try {
        const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
        const data = await orderRepository.getStats(fecha);
        
        const calcTrend = (hoy, ayer) => {
            if (ayer === 0 && hoy > 0) return 100;
            if (ayer === 0 && hoy === 0) return 0;
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
    } catch (error) {
        logger.error('Error al obtener stats', { error: error.message });
        next(error);
    }
};

// GET /api/orders/products/:id/has-sales
const checkProductSales = async (req, res, next) => {
    try {
        const { id } = req.params;
        const exists = await orderRepository.checkProductInSales(id);
        res.status(200).json({ hasSales: exists });
    } catch (error) {
        logger.error('Error al verificar ventas de producto', { error: error.message });
        next(error);
    }
};

module.exports = { getOrders, getOrderById, getStats, createOrder, updateOrderStatus, deleteOrder, checkProductSales };
