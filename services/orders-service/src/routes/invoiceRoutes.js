'use strict';

const express = require('express');
const router  = express.Router();
const { getInvoices, getInvoiceById, createInvoice } = require('../controllers/invoiceController');

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: Listar facturas (paginado)
 *     tags: [Facturas]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de facturas.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Paginado'
 *                 - properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Factura'
 */
router.get('/', getInvoices);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Detalle de factura
 *     tags: [Facturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Factura con datos de la venta.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Factura'
 *       404:
 *         description: Factura no encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getInvoiceById);

/**
 * @swagger
 * /api/invoices:
 *   post:
 *     summary: Emitir factura para una venta
 *     tags: [Facturas]
 *     description: |
 *       Emite una factura asociada a una venta existente.
 *       Solo se puede emitir **una factura por venta** (409 si ya existe).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FacturaInput'
 *           examples:
 *             ejemplo:
 *               value:
 *                 fk_id_vent: 1
 *                 id_usu: 3
 *                 cantidad_vent: 2
 *                 precio_prod: 5.00
 *                 montototal_vent: 10.00
 *     responses:
 *       201:
 *         description: Factura emitida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Factura'
 *       400:
 *         description: Campos faltantes o valores inválidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Venta no encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: La venta ya tiene una factura.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', createInvoice);

module.exports = router;
