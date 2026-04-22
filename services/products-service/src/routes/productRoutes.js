'use strict';

const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const validate = require('../middlewares/validate');
const { createProductSchema, updateProductSchema, updateStockSchema } = require('../validators/productValidators');
const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    getLowStock,
} = require('../controllers/productController');

/**
 * @swagger
 * /api/products/low-stock:
 *   get:
 *     summary: Listar productos con bajo stock actual (global)
 *     tags: [Productos]
 *     responses:
 *       200:
 *         description: Array de productos que cumplen stock_actual <= stock_minimo.
 */
router.get('/low-stock', getLowStock);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Listar todos los productos (HU12)
 *     tags: [Productos]
 *     responses:
 *       200:
 *         description: Array de productos con categoría incluida.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Producto'
 */
router.get('/', getProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Ver detalles de un producto (HU15)
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Datos completos del producto.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 *       404:
 *         description: Producto no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getProductById);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Registrar un nuevo producto (HU10)
 *     tags: [Productos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoInput'
 *     responses:
 *       201:
 *         description: Producto creado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 *       400:
 *         description: Campos obligatorios faltantes o precio negativo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', upload.single('imagen'), validate(createProductSchema), createProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Actualizar un producto (HU11)
 *     tags: [Productos]
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
 *             $ref: '#/components/schemas/ProductoInput'
 *     responses:
 *       200:
 *         description: Producto actualizado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 *       404:
 *         description: Producto no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', upload.single('imagen'), validate(updateProductSchema), updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Eliminar un producto (HU13)
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Producto eliminado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Producto eliminado exitosamente.
 *       404:
 *         description: Producto no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', deleteProduct);

/**
 * @swagger
 * /api/products/{id}/stock:
 *   put:
 *     summary: Actualizar stock de un producto (suma/resta atómica)
 *     tags: [Productos]
 *     description: |
 *       Permite sumar o restar unidades del stock_actual de un producto.
 *       Si el stock resultante es menor o igual al stock_minimo, la respuesta incluirá
 *       `alerta_stock_critico: true`.
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
 *             type: object
 *             required: [cantidad]
 *             properties:
 *               cantidad:
 *                 type: integer
 *                 description: Unidades a sumar (positivo) o restar (negativo)
 *                 example: 10
 *           examples:
 *             entrada:
 *               summary: Sumar stock
 *               value:
 *                 cantidad: 50
 *             salida:
 *               summary: Restar stock
 *               value:
 *                 cantidad: -5
 *     responses:
 *       200:
 *         description: Stock actualizado. Incluye alerta si stock <= stock_minimo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 *       400:
 *         description: cantidad es obligatorio o no es entero.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Producto no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/stock', validate(updateStockSchema), updateStock);

module.exports = router;
