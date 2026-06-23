'use strict';
const logger = require('../config/logger');
const { generateInvoicePDF } = require('../utils/pdfBuilder');

const generateReceiptPdf = async (req, res) => {
    const { orderId } = req.params;
    try {
        // Compose Data from inner microservice network
        const orderRes = await fetch(`${process.env.ORDERS_SERVICE_URL}/api/orders/${orderId}`);
        
        if (!orderRes.ok) {
            if (orderRes.status === 404) return res.status(404).json({ error: 'Orden no encontrada' });
            return res.status(orderRes.status).json({ error: 'Fallo al obtener datos de la orden en services' });
        }
        
        const orderData = await orderRes.json();

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

module.exports = { generateReceiptPdf };
