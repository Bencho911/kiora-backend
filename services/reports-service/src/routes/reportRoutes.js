const express = require('express');
const router = express.Router();
const { generateReceiptPdf } = require('../controllers/reportController');
const { exportVentasExcel } = require('../controllers/exportController');

/**
 * @swagger
 * /receipt/{orderId}:
 *   get:
 *     summary: Genera factura PDF
 *     description: Retorna un stream binario de un archivo PDF (factura) con el detalle de la venta especificada por ID.
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la venta/orden a facturar
 *     responses:
 *       200:
 *         description: Archivo PDF renderizado exitosamente.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error interno del servidor al crear el PDF
 */
router.get('/receipt/:orderId', generateReceiptPdf);

/**
 * @swagger
 * /export/ventas:
 *   get:
 *     summary: Exportar reporte general de ventas (Excel para Power BI)
 *     description: >
 *       Genera y descarga un archivo Excel (.xlsx) completo y estructurado con
 *       toda la información de ventas del sistema Kiora. El archivo contiene
 *       5 hojas: Resumen Ejecutivo, Ventas, Detalle de Productos, Facturas y
 *       Ventas por Día. Optimizado para importación directa en Microsoft Power BI.
 *     tags: [Export]
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio para filtrar ventas (ISO 8601, ej. 2026-01-01)
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin para filtrar ventas (ISO 8601, ej. 2026-12-31)
 *     responses:
 *       200:
 *         description: Archivo Excel generado y descargado exitosamente.
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Error interno al generar el reporte
 *       503:
 *         description: El servicio de órdenes no está disponible
 */
router.get('/export/ventas', exportVentasExcel);

module.exports = router;
