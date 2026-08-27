'use strict';

import express from 'express';
const router = express.Router();
import * as controller from '../controllers/electronicInvoiceController.js';

/**
 * @swagger
 * /api/reports/electronic-invoice/{id_vent}:
 *   get:
 *     summary: Generar simulación de factura electrónica fiscal
 *     tags: [Facturación Electrónica]
 *     parameters:
 *       - in: path
 *         name: id_vent
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Objeto JSON con los datos fiscales simulados (CUFE, QR, Totales con IVA).
 *       404:
 *         description: Venta no encontrada.
 */
router.get('/:id_vent', controller.generateElectronicInvoice);
router.post('/:id_vent/cancel', controller.cancelElectronicInvoice);

export default router;
