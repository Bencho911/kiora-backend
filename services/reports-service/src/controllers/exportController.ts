'use strict';

import { logger } from '@kiora/shared';
import { generateSalesExcel  } from '../utils/excelBuilder.js';
import { getOrders } from '../repositories/reportRepository.js';

/**
 * exportController
 * Genera archivos Excel (.xlsx) completos y estructurados
 * para importación directa en Power BI.
 */

// GET /api/reports/export/ventas
const exportVentasExcel = async (req, res) => {
    const { desde, hasta } = req.query;

    try {
        // 1. Obtener dataset completo de la réplica local (CQRS)
        const data = await getOrders(desde as string, hasta as string);
        logger.info('Dataset de ventas obtenido desde réplica local', { records: data.length });

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

export { exportVentasExcel };
