'use strict';

const orderRepository = require('../repositories/orderRepository');
const logger = require('../config/logger');
const env = require('../config/env');

const outgoingHeaders = (req) => {
    const h = { 'Content-Type': 'application/json' };
    const cid = req.headers['x-correlation-id'];
    if (cid) h['x-correlation-id'] = cid;
    return h;
};

// GET /api/orders  — lista paginada
const getOrders = async (req, res, next) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page  || 1, 10));
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || 20, 10)));
        const offset = (page - 1) * limit;

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
        if (!order) return res.status(404).json({ error: 'Venta no encontrada.' });
        res.status(200).json(order);
    } catch (error) {
        logger.error('Error al obtener venta', { error: error.message });
        next(error);
    }
};

// POST /api/orders
const createOrder = async (req, res, next) => {
    const { metodopago_usu, items } = req.body;
    
    // El Gateway inyecta x-user-id tras validar el JWT
    const id_usu_header = req.headers['x-user-id'];
    const id_usu = id_usu_header ? parseInt(id_usu_header, 10) : req.body.id_usu;

    if (!id_usu) {
        return res.status(400).json({ error: 'No se pudo identificar al usuario (id_usu faltante).', code: 'USER_NOT_IDENTIFIED' });
    }

    try {
        const order = await orderRepository.createWithItems({ id_usu, metodopago_usu, items });
        logger.info('Venta creada', { id_vent: order.id_vent, id_usu });
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
        // 1. Obtenemos los ítems ANTES de intentar marcar la venta como completada
        const order = await orderRepository.findByIdWithItems(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Venta no encontrada.' });
        }

        // 2. Si se va a completar, interactuamos con el Inventario PRIMERO
        if (estado === 'completada' && order.items && order.items.length > 0) {
            const exitosos = [];
            let inventoryFailed = false;
            let errorDetails = null;

            for (const item of order.items) {
                try {
                    const movRes = await fetch(
                        `${env.inventoryServiceUrl}/api/inventory/movements`,
                        {
                            method: 'POST',
                            headers: outgoingHeaders(req),
                            body: JSON.stringify({
                                tipo_mov: 'salida',   // Solicitamos reducción
                                cantidad: item.cantidad,
                                cod_prod: item.cod_prod,
                                fk_id_vent: Number(orderId),
                            }),
                        }
                    );
                    if (!movRes.ok) {
                        inventoryFailed = true;
                        errorDetails = await movRes.text();
                        logger.warn('Fallo stock para un item', { cod_prod: item.cod_prod, status: movRes.status, body: errorDetails });
                        break; // Frenamos y desencadenamos rollback SAGA
                    } else {
                        // Guardamos en la memoria local los que sí pasaron (Para posible compensación)
                        exitosos.push(item);
                        logger.info('Stock restado temporalmente', { cod_prod: item.cod_prod });
                    }
                } catch (netErr) {
                    inventoryFailed = true;
                    errorDetails = netErr.message;
                    logger.error('Error de red contactando inventario', { cod_prod: item.cod_prod, err: netErr.message });
                    break;
                }
            }

            // ================= PATRÓN SAGA (COMPENSACIÓN) =================
            if (inventoryFailed) {
                logger.warn('⚠️ SAGA: Iniciando rollback de inventario por fallo en la venta', { itemsRevertir: exitosos.length });
                for (const reg of exitosos) {
                    try {
                        const compReq = await fetch(
                            `${env.inventoryServiceUrl}/api/inventory/movements`,
                            {
                                method: 'POST',
                                headers: outgoingHeaders(req),
                                body: JSON.stringify({
                                    tipo_mov: 'entrada', // Operación inversa a 'salida'
                                    cantidad: reg.cantidad,
                                    cod_prod: reg.cod_prod,
                                    fk_id_vent: Number(orderId),
                                    observaciones: 'COMPENSACION SAGA: FALLO DE ORDEN'
                                }),
                            }
                        );
                        if (!compReq.ok) {
                            logger.error('CRÍTICO: Falló la compensación SAGA', { cod_prod: reg.cod_prod });
                        } else {
                            logger.info('✅ SAGA: Producto devuelto al almacén digital', { cod_prod: reg.cod_prod });
                        }
                    } catch (e) {
                         logger.error('CRÍTICO: Caída de red durante compensación SAGA', { cod_prod: reg.cod_prod, err: e.message });
                    }
                }
                // Abortar la actualización de la base local y retornar 500 al cliente
                return res.status(500).json({ 
                    error: 'Error: Inventario insuficiente o servicio caído. Orden revertida automáticamente. No hubo cargos.', 
                    detalle: errorDetails 
                });
            }
        }

        // 3. Si el inventario fue un éxito perfecto o no era 'completada', aplicamos a Base de Datos local.
        const result = await orderRepository.updateStatus(orderId, estado);
        logger.info('Estado de venta consolidado en base de datos local', { id_vent: orderId, estado });

        res.status(200).json(result.rows[0]);
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
            return res.status(404).json({ error: 'Venta no encontrada.' });
        }
        logger.info('Venta eliminada', { id_vent: req.params.id });
        res.status(200).json({ message: 'Venta eliminada exitosamente.' });
    } catch (error) {
        logger.error('Error al eliminar venta', { error: error.message });
        next(error);
    }
};

module.exports = { getOrders, getOrderById, createOrder, updateOrderStatus, deleteOrder };
