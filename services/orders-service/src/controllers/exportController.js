'use strict';

const exportRepo = require('../repositories/exportRepository');
const logger = require('../config/logger');

/**
 * exportController
 * Endpoint interno consumido por reports-service para obtener
 * el dataset completo de ventas para exportación a Power BI.
 */

// GET /api/orders/export/full
const getFullExport = async (req, res, next) => {
    try {
        const filters = {
            desde: req.query.desde || null,
            hasta: req.query.hasta || null,
        };

        logger.info('Exportación completa solicitada', { filters });

        const [fullData, summary, byPayment, byDay] = await Promise.all([
            exportRepo.findFullExport(filters),
            exportRepo.findSummary(filters),
            exportRepo.findByPaymentMethod(filters),
            exportRepo.findByDay(filters),
        ]);

        res.status(200).json({
            generado_en: new Date().toISOString(),
            filtros: filters,
            resumen: summary.rows[0],
            ventas_por_metodo_pago: byPayment.rows,
            ventas_por_dia: byDay.rows,
            dataset: fullData.rows,
        });
    } catch (error) {
        logger.error('Error en exportación completa', { error: error.message });
        next(error);
    }
};

module.exports = { getFullExport };
