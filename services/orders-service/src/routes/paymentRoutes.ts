import express from 'express';
import { generateCheckoutParams, handleWompiWebhook } from '../controllers/paymentController';

const router = express.Router();

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
router.post('/webhook/wompi', handleWompiWebhook);
router.post('/webhook', handleWompiWebhook);
router.post('/webhook/', handleWompiWebhook);

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
router.post('/:id', generateCheckoutParams);

export default router;
