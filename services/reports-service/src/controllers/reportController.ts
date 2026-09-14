'use strict';
import { logger } from '@kiora/shared';
import { generateInvoicePDF  } from '../utils/pdfBuilder.js';

import { getOrderById } from '../repositories/reportRepository.js';

const generateReceiptPdf = async (req, res) => {
    const { orderId } = req.params;
    try {
        // Compose Data from local CQRS replica
        const orderData = await getOrderById(orderId);
        
        if (!orderData) {
            return res.status(404).json({ error: 'Orden no encontrada en la base de datos de reportes' });
        }

        // 1. Configuramos cabeceras para forzar la descarga de PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Factura-Kiora-${orderId}.pdf`);

        // 2. Iniciamos el Stream (consume nula memoria ya que drena los chunks)
        await generateInvoicePDF(orderData, res);
    } catch (e) {
        logger.error('Error generando PDF', { error: e?.message ?? 'Error desconocido (valor: ' + typeof e + ')' });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno generando el PDF.' });
        }
    }
};

export { generateReceiptPdf };
