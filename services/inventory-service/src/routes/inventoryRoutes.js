'use strict';

const express = require('express');
const router = express.Router();
const validate = require('../middlewares/validate');
const {
    createSupplierSchema,
    updateSupplierSchema,
    createMovementSchema,
    upsertSuministraSchema,
} = require('../validators/inventoryValidators');
const {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getMovements,
    createMovement,
    getSuministra,
    getSuministraById,
    upsertSuministra,
    getAlerts,
    getKardex,
    getSuministraByProduct,
    getLowStock,
} = require('../controllers/inventoryController');

/* ── Alertas (Kardex/Lotes) ───────────────────────────────────────────────── */

router.get('/alerts', getAlerts);
router.get('/products/:id/kardex', getKardex);

/* ── Proveedores ──────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/inventory/suppliers:
 *   get:
 *     summary: Listar proveedores
 *     tags: [Proveedores]
 *     responses:
 *       200:
 *         description: Array de proveedores.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Proveedor'
 */
router.get('/suppliers', getSuppliers);

/**
 * @swagger
 * /api/inventory/suppliers/{id}:
 *   get:
 *     summary: Detalle de proveedor
 *     tags: [Proveedores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Datos del proveedor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Proveedor'
 *       404:
 *         description: Proveedor no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/suppliers/:id', getSupplierById);

/**
 * @swagger
 * /api/inventory/suppliers:
 *   post:
 *     summary: Crear proveedor
 *     tags: [Proveedores]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProveedorInput'
 *     responses:
 *       201:
 *         description: Proveedor creado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Proveedor'
 *       400:
 *         description: nom_prov es obligatorio.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/suppliers', validate(createSupplierSchema), createSupplier);

/**
 * @swagger
 * /api/inventory/suppliers/{id}:
 *   put:
 *     summary: Actualizar proveedor
 *     tags: [Proveedores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProveedorInput'
 *     responses:
 *       200:
 *         description: Proveedor actualizado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Proveedor'
 *       404:
 *         description: Proveedor no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/suppliers/:id', validate(updateSupplierSchema), updateSupplier);

/**
 * @swagger
 * /api/inventory/suppliers/{id}:
 *   delete:
 *     summary: Eliminar proveedor
 *     tags: [Proveedores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Proveedor eliminado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Proveedor eliminado exitosamente.
 *       404:
 *         description: Proveedor no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/suppliers/:id', deleteSupplier);

/* ── Movimientos ──────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/inventory/movements:
 *   get:
 *     summary: Listar movimientos (filtro opcional por cod_prod)
 *     tags: [Movimientos]
 *     parameters:
 *       - in: query
 *         name: cod_prod
 *         schema:
 *           type: integer
 *         description: Filtrar por producto
 *         example: 1
 *     responses:
 *       200:
 *         description: Array de movimientos.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Movimiento'
 */
router.get('/movements', getMovements);

/**
 * @swagger
 * /api/inventory/movements:
 *   post:
 *     summary: Registrar movimiento de stock
 *     tags: [Movimientos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MovimientoInput'
 *     responses:
 *       201:
 *         description: Movimiento registrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Movimiento'
 *       400:
 *         description: Campos obligatorios faltantes o tipo inválido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/movements', validate(createMovementSchema), createMovement);

/* ── Suministra (HU14) ────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/inventory/low-stock:
 *   get:
 *     summary: Items con stock por debajo del mínimo (HU14)
 *     tags: [Suministra]
 *     responses:
 *       200:
 *         description: Array de registros con bajo stock.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Suministra'
 */
router.get('/low-stock', getLowStock);

/**
 * @swagger
 * /api/inventory/suministra:
 *   get:
 *     summary: Listar todos los registros proveedor-producto
 *     tags: [Suministra]
 *     responses:
 *       200:
 *         description: Array de suministra.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Suministra'
 */
router.get('/suministra', getSuministra);

/**
 * @swagger
 * /api/inventory/suministra/{id}:
 *   get:
 *     summary: Detalle de suministra por ID
 *     tags: [Suministra]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Registro de suministra.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Suministra'
 *       404:
 *         description: No encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/suministra/:id', getSuministraById);

/**
 * @swagger
 * /api/inventory/suministra/product/{cod_prod}:
 *   get:
 *     summary: Obtener suministra por código de producto
 *     tags: [Suministra]
 *     parameters:
 *       - in: path
 *         name: cod_prod
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Registro de suministra para el producto.
 *       404:
 *         description: No encontrado.
 */
router.get('/suministra/product/:cod_prod', getSuministraByProduct);

/**
 * @swagger
 * /api/inventory/suministra:
 *   post:
 *     summary: Crear/actualizar stock con stock mínimo (HU14)
 *     tags: [Suministra]
 *     description: |
 *       Crea o actualiza (upsert) la relación proveedor-producto.
 *       Si `stock < stock_minimo`, la respuesta incluirá `alerta_stock_minimo: true`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SuministraInput'
 *           examples:
 *             bajoCeroStock:
 *               summary: Stock por debajo del mínimo
 *               value:
 *                 fk_cod_prov: 1
 *                 cod_prod: 1
 *                 stock: 5
 *                 stock_minimo: 10
 *             stockSuficiente:
 *               summary: Stock suficiente
 *               value:
 *                 fk_cod_prov: 1
 *                 cod_prod: 1
 *                 stock: 20
 *                 stock_minimo: 10
 *     responses:
 *       200:
 *         description: Registro actualizado. Incluye alerta si stock < stock_minimo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuministraResponse'
 *       400:
 *         description: Campos obligatorios faltantes o valores negativos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/suministra', validate(upsertSuministraSchema), upsertSuministra);

module.exports = router;
