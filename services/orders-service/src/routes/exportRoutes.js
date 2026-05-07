'use strict';

const express = require('express');
const router = express.Router();
const { getFullExport } = require('../controllers/exportController');

/**
 * @swagger
 * /export/full:
 *   get:
 *     summary: Dataset completo de ventas (uso interno)
 *     description: >
 *       Retorna toda la información denormalizada de ventas, detalle de productos
 *       y facturas. Diseñado para consumo interno por reports-service.
 *     tags: [Export]
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicio (ISO 8601)
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin (ISO 8601)
 *     responses:
 *       200:
 *         description: Dataset exportado exitosamente
 *       500:
 *         description: Error interno
 */
router.get('/full', getFullExport);

module.exports = router;
