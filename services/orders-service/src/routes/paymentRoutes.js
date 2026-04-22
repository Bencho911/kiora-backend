'use strict';

const express = require('express');
const router = express.Router();
const { generateCheckoutParams } = require('../controllers/paymentController');

/**
 * @swagger
 * /api/orders/checkout/{id}:
 *   post:
 *     summary: Generar enlace de pago de Stripe para una orden
 *     tags: [Pagos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Retorna la URL de Stripe Checkout.
 *       400:
 *         description: Orden ya pagada.
 *       404:
 *         description: Orden no encontrada.
 */
router.post('/:id', generateCheckoutParams);

module.exports = router;
