'use strict';

const invoiceRepository = require('../repositories/invoiceRepository');
const orderRepository   = require('../repositories/orderRepository');
const logger = require('../config/logger');

// GET /api/orders/invoices
const getInvoices = async (req, res, next) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page  || 1, 10));
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || 20, 10)));
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
    } catch (error) {
        logger.error('Error al listar facturas', { error: error.message });
        next(error);
    }
};

// GET /api/orders/invoices/:id
const getInvoiceById = async (req, res, next) => {
    try {
        const result = await invoiceRepository.findById(req.params.id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al obtener factura', { error: error.message });
        next(error);
    }
};

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
        logger.info('Factura emitida', { factura_id: result.rows[0].id, fk_id_vent });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al emitir factura', { error: error.message });
        next(error);
    }
};

module.exports = { getInvoices, getInvoiceById, createInvoice };
