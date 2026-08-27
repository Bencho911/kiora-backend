'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const uploadMiddleware_1 = __importDefault(require("../middlewares/uploadMiddleware"));
const parseFormData_1 = __importDefault(require("../middlewares/parseFormData"));
const validate_1 = __importDefault(require("../middlewares/validate"));
const productValidators_1 = require("../validators/productValidators");
const productController_1 = require("../controllers/productController");
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
router.get('/low-stock', productController_1.getLowStock);
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
router.get('/', productController_1.getProducts);
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
router.get('/:id', productController_1.getProductById);
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
router.post('/', uploadMiddleware_1.default.single('imagen'), parseFormData_1.default, (0, validate_1.default)(productValidators_1.createProductSchema), productController_1.createProduct);
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
router.put('/:id', uploadMiddleware_1.default.single('imagen'), parseFormData_1.default, (0, validate_1.default)(productValidators_1.updateProductSchema), productController_1.updateProduct);
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
router.delete('/:id', productController_1.deleteProduct);
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
router.put('/:id/stock', (0, validate_1.default)(productValidators_1.updateStockSchema), productController_1.updateStock);
exports.default = router;
