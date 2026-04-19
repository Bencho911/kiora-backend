'use strict';

const PDFDocument = require('pdfkit');

const generateInvoicePDF = (order, responseStream) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });

            // Conectar el dibujado de PDFKit directamente al Stream de Express JS
            doc.pipe(responseStream);
            doc.on('end', () => resolve());
            doc.on('error', (err) => reject(err));

            // Encabezado
            doc.fontSize(25).text('Kiora Micro-Market', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Recibo de Compra #${order.id_vent || '-'}`, { align: 'center' });
            doc.text(`Fecha: ${new Date(order.fecha_vent).toLocaleString('es-CO')}`, { align: 'center' });
            doc.text(`Método de Pago: ${(order.metodopago_usu || 'Efectivo').toUpperCase()}`, { align: 'center' });
            doc.moveDown(2);

            // Cabeceras de la Tabla
            const startX = 50;
            let currentY = doc.y;
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Producto', startX, currentY);
            doc.text('Cant', startX + 250, currentY);
            doc.text('Precio', startX + 300, currentY);
            doc.text('Subtotal', startX + 400, currentY);
            
            doc.moveTo(startX, currentY + 15).lineTo(550, currentY + 15).stroke();
            currentY += 25;

            // Filas
            doc.font('Helvetica');
            let items = order.items || [];
            items.forEach((item) => {
                doc.text(item.nombre_prod || `Item #${item.cod_prod}`, startX, currentY);
                doc.text(item.cantidad.toString(), startX + 250, currentY);
                doc.text(`$${Number(item.precio_unit).toLocaleString('es-CO')}`, startX + 300, currentY);
                doc.text(`$${Number(item.subtotal).toLocaleString('es-CO')}`, startX + 400, currentY);
                currentY += 20;

                // Salto de página si toca
                if (currentY > 700) {
                    doc.addPage();
                    currentY = 50;
                }
            });

            // Sección del Total
            doc.moveTo(startX, currentY).lineTo(550, currentY).stroke();
            currentY += 15;
            doc.font('Helvetica-Bold').fontSize(14);
            doc.text(`Total CSD: $${Number(order.montofinal_vent).toLocaleString('es-CO')}`, startX + 280, currentY);

            // Pie de Página
            doc.moveDown(4);
            doc.font('Helvetica').fontSize(10);
            doc.text('¡Gracias por comprar Inteligente en Kiora!', { align: 'center' });
            doc.text('Sistema de Venta Automatizada 24/7', { align: 'center', color: 'gray' });

            // Finalizar PDF y liberar memoria
            doc.end();
        } catch(e) {
            reject(e);
        }
    });
};

module.exports = { generateInvoicePDF };
