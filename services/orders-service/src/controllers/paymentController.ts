import { Request, Response, NextFunction } from 'express';
import * as wompiService from '../services/wompiService';
import * as orderService from '../services/orderService';
import * as orderRepository from '../repositories/orderRepository';
import logger from '../config/logger';
import { outgoingHeaders, fetchWithRetry, DEFAULT_TIMEOUT_MS } from '../utils/httpClient';

export const generateCheckoutParams = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { redirect_url } = req.body || {};

    try {
        const orden = await orderRepository.findByIdWithItems(id as string);
        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada.' });
        }

        if (orden.estado === 'pagado' || orden.estado === 'completada') {
            return res.status(400).json({ error: 'La orden ya está pagada o completada.' });
        }

        // ── LLAMADA SÍNCRONA: Validar stock antes de cobrar ──
        // Se mantiene síncrona intencionalmente: es mejor decirle al cliente
        // "no hay stock" ANTES de cobrarle, que cobrar y reembolsar después.
        const headers = outgoingHeaders(req.headers);
        let reserveRes: any;
        try {
            reserveRes = await fetchWithRetry(
                process.env.INVENTORY_SERVICE_URL + '/api/inventory/saga/reserve',
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ orderId: orden.id_vent, items: orden.items }),
                },
                {
                    maxRetries: 1,
                    timeoutMs: DEFAULT_TIMEOUT_MS,
                    onNonRetryable: (status) => status >= 400 && status < 500,
                }
            );
        } catch (inventoryErr: unknown) {
            logger.error('Error de conectividad con inventory-service al reservar', {
                orderId: id, error: (inventoryErr as Error).message, code: (inventoryErr as any).code,
            });
            return res.status(503).json({
                error: 'No se pudo validar el inventario. Intenta de nuevo en unos segundos.',
                detail: (inventoryErr as Error).message,
            });
        }

        if (!reserveRes.ok) {
            const errData = await reserveRes.json().catch(() => ({}));
            return res.status(409).json({ error: errData.error || 'Agotado o fallo reservando inventario temporalmente' });
        }

        let checkoutUrl;
        try {
            const result = await wompiService.createCheckoutUrl(orden, redirect_url || null);
            checkoutUrl = result.checkoutUrl;
        } catch (wompiErr: unknown) {
            logger.error('Error creando URL de checkout Wompi', {
                orderId: id, error: (wompiErr as Error).message,
            });
            return res.status(502).json({
                error: 'Error al generar el enlace de pago con Wompi.',
                detail: (wompiErr as Error).message,
            });
        }

        res.status(200).json({
            status: 'ok',
            checkoutUrl,
        });

    } catch (error: unknown) {
        logger.error('Error generando link de pago Checkout', { error: (error as Error).message, stack: (error as Error).stack });
        res.status(500).json({ error: 'Error interno generando link de pago.', detail: (error as Error).message });
    }
};

export const handleWompiWebhook = async (req: Request, res: Response) => {
    const body = req.body;

    // Verificar firma del webhook
    try {
        wompiService.verifyWebhookSignature(body);
    } catch (err: unknown) {
        logger.error('Webhook Wompi: firma inválida', { detail: (err as Error).message });
        return res.status(401).json({ error: 'Webhook Error: ' + (err as Error).message });
    }

    const event = body.event;
    const transaction = body.data?.transaction;

    if (event === 'transaction.updated' && transaction?.status === 'APPROVED') {
        const reference = transaction.reference;
        const orderId = wompiService.extractOrderIdFromReference(reference);

        if (!orderId) {
            logger.warn('Wompi Webhook: referencia sin orderId reconocible', { reference });
            return res.json({ received: true });
        }

        const transactionId = transaction.id;
        logger.info('Wompi Webhook: Transacción aprobada', { orderId, transactionId, reference });

        try {
            // completeOrder en una sola transacción atómica:
            //   a) Cambia estado a 'completada' (+ guarda transactionId)
            //   b) Crea la factura
            //   c) Inserta eventos outbox de movimiento de inventario
            //   d) Inserta evento outbox para facturación electrónica (Factus/DIAN)
            //   e) Envía broadcast WebSocket al dashboard
            const result = await orderService.completeOrder(orderId, req.headers, transactionId);

            if (!result.ok) {
                logger.error('Error completando orden desde webhook Wompi', {
                    orderId, error: result.error, code: result.code,
                });
                return res.status(result.status || 500).json({ error: result.error || 'Error completando la orden.' });
            }
        } catch (err: unknown) {
            logger.error('Error CRÍTICO en webhook Wompi — excepción no capturada en completeOrder', {
                orderId, error: (err as Error).message, stack: (err as Error).stack,
            });
            return res.status(500).json({ error: 'Error interno procesando el webhook.' });
        }
    }

    res.json({ received: true });
};
