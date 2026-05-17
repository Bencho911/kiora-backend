'use strict';

const factusService = require('../services/factusService');
const env = require('../config/env');
const logger = require('../config/logger');

/**
 * electronicInvoiceController
 * Emite una factura electronica real via Factus API o simulada si no esta configurado.
 */

const generateElectronicInvoice = async (req, res, next) => {
    try {
        const { id_vent } = req.params;

        // 1. Obtener la orden real desde orders-service
        const orderRes = await fetch(`${env.ordersServiceUrl}/api/orders/${id_vent}`);

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

        logger.info('Factura electronica generada', {
            id_vent,
            factus: invoiceResult.status || 'ok',
        });

        res.status(200).json(invoiceResult);
    } catch (error) {
        logger.error('Error generando factura electronica', { error: error.message });
        next(error);
    }
};

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

        logger.info('Anulacion de factura electronica', {
            id_vent,
            reference_code,
            factus_status: result.status,
        });

        res.status(200).json(result);
    } catch (error) {
        logger.error('Error anulando factura electronica', { error: error.message });
        next(error);
    }
};

module.exports = {
    generateElectronicInvoice,
    cancelElectronicInvoice,
};
