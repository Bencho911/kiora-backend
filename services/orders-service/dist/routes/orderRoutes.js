"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const validate_1 = __importDefault(require("../middlewares/validate"));
const orderValidators_1 = require("../validators/orderValidators");
const orderController_1 = require("../controllers/orderController");
const router = express_1.default.Router();
/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Listar ventas (paginado)
 *     tags: [Ventas]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de ventas.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Paginado'
 *                 - properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Venta'
 */
router.get('/', orderController_1.getOrders);
/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Detalle de venta con items
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Venta con sus líneas de detalle.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Venta'
 *       404:
 *         description: Venta no encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/stats', orderController_1.getStats);
router.get('/products/:id/has-sales', orderController_1.checkProductSales);
router.get('/:id', orderController_1.getOrderById);
/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Crear venta con líneas de detalle
 *     tags: [Ventas]
 *     description: |
 *       Crea la venta y sus `Producto_Venta` en una transacción atómica.
 *       El `montofinal_vent` se calcula automáticamente como `SUM(precio_unit * cantidad)`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VentaInput'
 *           examples:
 *             ejemplo:
 *               summary: Venta con 2 productos
 *               value:
 *                 metodopago_usu: efectivo
 *                 items:
 *                   - cod_prod: 1
 *                     cantidad: 2
 *                     precio_unit: 5.00
 *                   - cod_prod: 2
 *                     cantidad: 1
 *                     precio_unit: 3.50
 *     responses:
 *       201:
 *         description: Venta creada con sus items.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Venta'
 *       400:
 *         description: Validación fallida (items vacíos o campos faltantes).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', (0, validate_1.default)(orderValidators_1.createOrderSchema), orderController_1.createOrder);
/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Cambiar estado de una venta
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [pendiente, completada, cancelada]
 *                 example: completada
 *     responses:
 *       200:
 *         description: Venta actualizada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Venta'
 *       400:
 *         description: Estado inválido.
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
 */
router.put('/:id/status', (0, validate_1.default)(orderValidators_1.updateOrderStatusSchema), orderController_1.updateOrderStatus);
/**
 * @swagger
 * /api/orders/{id}:
 *   delete:
 *     summary: Eliminar venta (y sus items en cascada)
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Venta eliminada.
 *       404:
 *         description: Venta no encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', orderController_1.deleteOrder);
exports.default = router;
