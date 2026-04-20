const express = require('express');
const router = express.Router();
const { generateReceiptPdf } = require('../controllers/reportController');

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

module.exports = router;
