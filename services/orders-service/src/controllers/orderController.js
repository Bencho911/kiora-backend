'use strict';

const orderRepository = require('../repositories/orderRepository');
const orderService = require('../services/orderService');
const parsePagination = require('../utils/parsePagination');
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

// POST /api/orders
const createOrder = async (req, res, next) => {
    const { metodopago_usu, items } = req.body;
    const id_usu_header = req.headers['x-user-id'];
    const id_usu = id_usu_header ? parseInt(id_usu_header, 10) : req.body.id_usu;

    if (!id_usu) {
        return res.status(400).json({ error: 'No se pudo identificar al usuario (id_usu faltante).', code: 'USER_NOT_IDENTIFIED' });
    }

    try {
        const order = await orderService.createOrder({ id_usu, metodopago_usu, items });
        res.status(201).json(order);
    } catch (error) {
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

module.exports = { getOrders, getOrderById, createOrder, updateOrderStatus, deleteOrder };
