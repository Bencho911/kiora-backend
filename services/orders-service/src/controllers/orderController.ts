import { Request, Response, NextFunction } from 'express';
import * as orderRepository from '../repositories/orderRepository';
import * as orderService from '../services/orderService';
import { parsePagination } from '../utils/parsePagination';
import { logActivity } from '../utils/logActivity';
import logger from '../config/logger';

/**
 * orderController
 * Responsabilidad: orquestar request → service/repository → response.
 * La lógica de negocio (Saga, circuit breaker) está en orderService.
 */

// GET /api/orders — lista paginada
export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
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
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
        next(error);
    }
};

// GET /api/orders/:id
export const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const order = await orderRepository.findByIdWithItems((req.params.id as string));
        if (!order) return res.status(404).json({ error: 'Venta no encontrada.', code: 'NOT_FOUND' });
        res.status(200).json(order);
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
        next(error);
    }
};

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
    const { metodopago_usu, items, descuento_global, store_id, tipo_entrega, fk_id_mesa } = req.body;

    try {
        const order = await orderService.createOrder({ metodopago_usu, items, descuento_global, store_id, tipo_entrega, fk_id_mesa });
        res.status(201).json(order);

        logActivity({ user_email: (req.headers['x-user-email'] as string) || ((req as any).user?.correo_usu as string), user_name: (req.headers['x-user-name'] as string) || ((req as any).user?.nombre_usu as string) || 'Desconocido', action: 'created', entity_type: 'order', entity_id: order.id_vent, details: `Venta #${order.id_vent} creada por $${order.montofinal_vent || 0}` });
    } catch (error: unknown) {
        if ((error as any).status === 403 && (error as any).code === 'BUSINESS_CLOSED') {
            return res.status(403).json({ error: (error as Error).message, code: (error as any).code });
        }
        logger.error('error', { error: (error as Error).message });
        next(error);
    }
};

// PUT /api/orders/:id/status
export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
    const { estado } = req.body;
    const orderId = (req.params.id as string);

    try {
        const result = await orderService.updateStatus(orderId, estado, req.headers);

        if (result.error) {
            return res.status(result.status || 500).json({
                error: result.error,
                code: result.code || 'ORDER_STATUS_ERROR',
                details: (result as any).details,
            });
        }

        res.status(200).json(result.data);

        logActivity({ user_email: ((req as any).user?.correo_usu as string) || (req.headers['x-user-email'] as string), user_name: ((req as any).user?.nombre_usu as string) || (req.headers['x-user-name'] as string) || 'Desconocido', action: estado === 'cancelada' ? 'deleted' : 'updated', entity_type: 'order', entity_id: orderId, details: `Venta #${orderId} → estado: ${estado}` });
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
        next(error);
    }
};

// DELETE /api/orders/:id
export const deleteOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await orderRepository.remove((req.params.id as string));
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Venta no encontrada.', code: 'NOT_FOUND' });
        }
        logger.info('Venta eliminada', { id_vent: (req.params.id as string) });
        res.status(200).json({ message: 'Venta eliminada exitosamente.' });
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
        next(error);
    }
};

// GET /api/orders/stats
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
        const period = req.query.period || '7d';
        const data = await orderRepository.getStats(fecha as string, period as string);
        
        const calcTrend = (hoy: number, ayer: number) => {
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
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
        next(error);
    }
};

// GET /api/orders/products/:id/has-sales
export const checkProductSales = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const exists = await orderRepository.checkProductInSales(id as string);
        res.status(200).json({ hasSales: exists });
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
        next(error);
    }
};
