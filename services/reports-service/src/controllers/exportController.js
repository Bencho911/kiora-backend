'use strict';

const logger = require('../config/logger');
const { generateSalesExcel } = require('../utils/excelBuilder');

/**
 * exportController
 * Genera archivos Excel (.xlsx) completos y estructurados
 * para importación directa en Power BI.
 */

// GET /api/reports/export/ventas
const exportVentasExcel = async (req, res) => {
    const { desde, hasta } = req.query;

    try {
        // 1. Obtener dataset completo del orders-service (red interna)
        const ordersUrl = process.env.ORDERS_SERVICE_URL || 'http://localhost:3004';
        const params = new URLSearchParams();
        if (desde) params.append('desde', desde);
        if (hasta) params.append('hasta', hasta);

        const queryString = params.toString() ? `?${params.toString()}` : '';
        const fetchUrl = `${ordersUrl}/api/orders/export/full${queryString}`;

        logger.info('Solicitando dataset de ventas para exportación', { fetchUrl });

        const response = await fetch(fetchUrl);

        if (!response.ok) {
            const errBody = await response.text();
            logger.error('Error obteniendo datos de orders-service', { status: response.status, body: errBody });
            return res.status(response.status).json({
                error: 'No se pudieron obtener los datos de ventas.',
                details: errBody,
            });
        }

        const data = await response.json();

        // 2. Generar nombre descriptivo del archivo
        const ahora = new Date().toISOString().slice(0, 10);
        const rangoTexto = desde && hasta
            ? `_${desde}_a_${hasta}`
            : desde
              ? `_desde_${desde}`
              : hasta
                ? `_hasta_${hasta}`
                : '';
        const filename = `Kiora_Reporte_Ventas${rangoTexto}_${ahora}.xlsx`;

        // 3. Configurar headers HTTP para descarga
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // 4. Generar y escribir el Excel al response
        await generateSalesExcel(data, res);
        res.end();

        logger.info('Reporte Excel de ventas generado exitosamente', { filename });
    } catch (e) {
        logger.error('Error generando Excel de ventas', { error: e.message, stack: e.stack });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno generando el reporte Excel.' });
        }
    }
};

module.exports = { exportVentasExcel };
