'use strict';

const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');

/**
 * @swagger
 * /api/orders/settlement/daily:
 *   get:
 *     summary: Liquidación Diaria de Ventas (Cierre de Caja)
 *     tags: [Ventas]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Fecha a consultar (YYYY-MM-DD). Si se omite, usa la de hoy.
 *     responses:
 *       200:
 *         description: Resumen de ventas del día por método de pago.
 *       400:
 *         description: Formato de fecha inválido.
 */
router.get('/daily', settlementController.getDailySettlement);

module.exports = router;
