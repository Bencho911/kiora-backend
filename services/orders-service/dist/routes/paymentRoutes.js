"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controllers/paymentController");
const router = express_1.default.Router();
/**
 * @swagger
 * /api/orders/checkout/webhook/wompi:
 *   post:
 *     summary: Webhook de Wompi para confirmación de pagos
 *     tags: [Pagos]
 *     responses:
 *       200:
 *         description: Evento procesado.
 *       401:
 *         description: Firma inválida.
 */
router.post('/webhook/wompi', paymentController_1.handleWompiWebhook);
router.post('/webhook', paymentController_1.handleWompiWebhook);
router.post('/webhook/', paymentController_1.handleWompiWebhook);
/**
 * @swagger
 * /api/orders/checkout/{id}:
 *   post:
 *     summary: Generar enlace de pago de Wompi para una orden
 *     tags: [Pagos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Retorna la URL de Wompi Checkout.
 *       400:
 *         description: Orden ya pagada.
 *       404:
 *         description: Orden no encontrada.
 */
router.post('/:id', paymentController_1.generateCheckoutParams);
exports.default = router;
