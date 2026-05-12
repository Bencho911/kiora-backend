'use strict';

const PDFDocument = require('pdfkit');

const generateInvoicePDF = (order, responseStream) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 0, size: 'A4' });
            doc.pipe(responseStream);
            doc.on('end', () => resolve());
            doc.on('error', (err) => reject(err));

            const PRIMARY_COLOR = '#ec131e';
            const TEXT_MAIN = '#282828';
            const TEXT_MUTED = '#787878';

            // Top Header Banner
            doc.rect(0, 0, 595.28, 100).fill(PRIMARY_COLOR);
            
            doc.fillColor('#FFFFFF').fontSize(36).font('Helvetica-Bold')
               .text('KIORA', 50, 35);
               
            doc.fontSize(10).font('Helvetica')
               .text('TECNOLOGÍA Y SERVICIOS', 50, 75);
               
            doc.fontSize(24).font('Helvetica-Bold')
               .text('RECIBO DE CAJA', 0, 45, { align: 'right', width: 545 });

            // Company & Invoice Info
            doc.fillColor(TEXT_MAIN).fontSize(10).font('Helvetica-Bold')
               .text('Facturar a:', 50, 130);
            doc.font('Helvetica').fillColor(TEXT_MUTED)
               .text('Cliente General', 50, 145)
               .text('Método de Pago: ' + (order.metodopago_usu || 'Efectivo').toUpperCase(), 50, 160);

            doc.fillColor(TEXT_MAIN).font('Helvetica-Bold')
               .text('Detalles del Recibo:', 350, 130);
            doc.font('Helvetica').fillColor(TEXT_MUTED)
               .text('Recibo #: ' + (order.id_vent || '-'), 350, 145)
               .text('Fecha: ' + new Date(order.fecha_vent).toLocaleString('es-CO'), 350, 160)
               .text('Estado: ' + (order.estado || 'Completada').toUpperCase(), 350, 175);

            // Table Header
            let currentY = 220;
            doc.rect(50, currentY, 495.28, 25).fill(PRIMARY_COLOR);
            
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
            doc.text('PRODUCTO', 60, currentY + 8);
            doc.text('CANT', 330, currentY + 8, { width: 40, align: 'center' });
            doc.text('PRECIO UNIT', 380, currentY + 8, { width: 75, align: 'right' });
            doc.text('SUBTOTAL', 465, currentY + 8, { width: 70, align: 'right' });
            
            currentY += 35;

            // Table Rows
            let items = order.items || [];
            items.forEach((item, i) => {
                const subtotal = Number(item.cantidad) * Number(item.precio_unit);
                
                // Alternate row background
                if (i % 2 === 1) {
                    doc.rect(50, currentY - 5, 495.28, 25).fill('#fcfcfc');
                }
                
                doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10);
                doc.text(item.nom_prod || `Item #${item.cod_prod}`, 60, currentY, { width: 260, height: 15, ellipsis: true });
                doc.text(item.cantidad.toString(), 330, currentY, { width: 40, align: 'center' });
                doc.text(`$${Number(item.precio_unit).toLocaleString('es-CO')}`, 380, currentY, { width: 75, align: 'right' });
                doc.text(`$${subtotal.toLocaleString('es-CO')}`, 465, currentY, { width: 70, align: 'right' });
                
                currentY += 25;

                if (currentY > 700) {
                    doc.addPage({ margin: 0, size: 'A4' });
                    currentY = 50;
                    // Draw header again
                    doc.rect(50, currentY, 495.28, 25).fill(PRIMARY_COLOR);
                    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
                    doc.text('PRODUCTO', 60, currentY + 8);
                    doc.text('CANT', 330, currentY + 8, { width: 40, align: 'center' });
                    doc.text('PRECIO UNIT', 380, currentY + 8, { width: 75, align: 'right' });
                    doc.text('SUBTOTAL', 465, currentY + 8, { width: 70, align: 'right' });
                    currentY += 35;
                }
            });

            // Separator
            doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor('#eeeeee').lineWidth(1).stroke();
            currentY += 15;

            // Totals
            doc.fillColor(TEXT_MAIN).font('Helvetica-Bold').fontSize(14);
            doc.text('TOTAL A PAGAR:', 300, currentY, { width: 150, align: 'right' });
            doc.fillColor(PRIMARY_COLOR);
            doc.text(`$${Number(order.montofinal_vent).toLocaleString('es-CO')}`, 455, currentY, { width: 90, align: 'right' });

            // Footer
            const pageHeight = 841.89; // A4 height
            doc.rect(0, pageHeight - 50, 595.28, 50).fill('#f9f9f9');
            doc.fillColor(TEXT_MUTED).font('Helvetica-Oblique').fontSize(9);
            doc.text('Esta factura es un soporte legal de su compra realizada en Kiora.', 0, pageHeight - 35, { align: 'center', width: 595.28 });
            doc.text('Para soporte o reclamaciones, escriba a KiosKiora@gmail.com', 0, pageHeight - 20, { align: 'center', width: 595.28 });

            doc.end();
        } catch(e) {
            reject(e);
        }
    });
};

module.exports = { generateInvoicePDF };
