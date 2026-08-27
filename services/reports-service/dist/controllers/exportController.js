'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportVentasExcel = void 0;
const logger_js_1 = __importDefault(require("../config/logger.js"));
const excelBuilder_js_1 = require("../utils/excelBuilder.js");
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
        if (desde)
            params.append('desde', desde);
        if (hasta)
            params.append('hasta', hasta);
        const queryString = params.toString() ? `?${params.toString()}` : '';
        const fetchUrl = `${ordersUrl}/api/orders/export/full${queryString}`;
        logger_js_1.default.info('Solicitando dataset de ventas para exportación', { fetchUrl });
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            const errBody = await response.text();
            logger_js_1.default.error('Error obteniendo datos de orders-service', { status: response.status, body: errBody });
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
        await (0, excelBuilder_js_1.generateSalesExcel)(data, res);
        res.end();
        logger_js_1.default.info('Reporte Excel de ventas generado exitosamente', { filename });
    }
    catch (e) {
        logger_js_1.default.error('Error generando Excel de ventas', { error: e.message, stack: e.stack });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno generando el reporte Excel.' });
        }
    }
};
exports.exportVentasExcel = exportVentasExcel;
