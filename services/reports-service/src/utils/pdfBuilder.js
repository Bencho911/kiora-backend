'use strict';

const PDFDocument = require('pdfkit');

// ─── Constantes de diseño ───────────────────────────────────────────────────────
const COLORS = {
  primary:   '#ec131e',  // Rojo Kiora
  secondary: '#8b0000',  // Rojo oscuro
  dark:      '#1a1a1a',
  gray:      '#6b7280',
  lightBg:   '#f9fafb',
  border:    '#e5e7eb',
  white:     '#ffffff',
};

const MARGIN = 50;
const PAGE_WIDTH  = 595.28; // A4 width
const PAGE_HEIGHT = 841.89; // A4 height
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// ─── Helpers de dibujo ──────────────────────────────────────────────────────────

function drawHeader(doc) {
  // Barra superior roja
  doc.rect(0, 0, PAGE_WIDTH, 12).fill(COLORS.primary);

  // Logo / nombre
  doc.fillColor(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(26);
  doc.text('KIORA', MARGIN, 32);

  doc.fillColor(COLORS.gray);
  doc.font('Helvetica').fontSize(9);
  doc.text('Micro-Market', MARGIN, 60);

  // Línea decorativa debajo del header
  doc.moveTo(MARGIN, 80).lineTo(PAGE_WIDTH - MARGIN, 80).strokeColor(COLORS.border).lineWidth(1).stroke();
}

function drawFooter(doc, pageNumber) {
  try {
    const y = PAGE_HEIGHT - 50;
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor(COLORS.border).lineWidth(1).stroke();
    doc.fillColor(COLORS.gray).font('Helvetica').fontSize(8);
    doc.text('Kiora Micro-Market — Sistema de Venta Automatizada 24/7', MARGIN, y + 10, { align: 'center' });
    doc.text(`Página ${pageNumber}`, PAGE_WIDTH - MARGIN - 60, y + 10, { align: 'right', width: 60 });
    doc.text('Gracias por su compra', MARGIN, y + 10, { width: 100 });
  } catch (_) { /* ignorar errores del footer */ }
}

function drawInfoBlock(doc, order) {
  const leftX = MARGIN;
  const rightX = PAGE_WIDTH / 2 + 10;
  const startY = 100;

  // ── Columna izquierda: Información del cliente / empresa ──
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(10);
  doc.text('FACTURA', leftX, startY);

  doc.fillColor(COLORS.gray).font('Helvetica').fontSize(9);
  doc.text('NIT: 901.XXX.XXX-X', leftX, startY + 16);
  doc.text('Kiora Micro-Market S.A.S.', leftX, startY + 28);
  doc.text('Bogotá, Colombia', leftX, startY + 40);
  doc.text('kiora.app', leftX, startY + 52);

  // ── Columna derecha: Datos del recibo ──
  const rightLabelX = rightX;
  const rightValueX = rightX + 80;

  doc.fillColor(COLORS.gray).font('Helvetica').fontSize(9);
  doc.text('No. Recibo:', rightLabelX, startY);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold');
  doc.text(`#${String(order.id_vent || '-').padStart(6, '0')}`, rightValueX, startY);

  doc.fillColor(COLORS.gray).font('Helvetica');
  doc.text('Fecha:', rightLabelX, startY + 16);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold');
  doc.text(order.fecha_vent ? new Date(order.fecha_vent).toLocaleString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '-', rightValueX, startY + 16);

  doc.fillColor(COLORS.gray).font('Helvetica');
  doc.text('Método de Pago:', rightLabelX, startY + 32);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold');
  doc.text((order.metodopago_usu || 'Efectivo').toUpperCase(), rightValueX, startY + 32);

  doc.fillColor(COLORS.gray).font('Helvetica');
  doc.text('Estado:', rightLabelX, startY + 48);
  doc.fillColor('#059669').font('Helvetica-Bold');
  doc.text('PAGADO', rightValueX, startY + 48);
}

function drawTableHeader(doc, y) {
  const cols = [
    { x: MARGIN + 12, w: 240, label: 'PRODUCTO', align: 'left' },
    { x: 260, w: 60,  label: 'CANT',     align: 'center' },
    { x: 320, w: 80,  label: 'PRECIO',   align: 'right' },
    { x: 405, w: 100, label: 'SUBTOTAL', align: 'right' },
  ];

  // Fondo del header
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 22, 4).fill(COLORS.primary);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(9);

  cols.forEach(c => {
    doc.text(c.label, c.x, y + 6, { width: c.w, align: c.align });
  });

  return y + 30;
}

function drawTableRow(doc, y, item, index) {
  const cols = [
    { x: MARGIN + 12, w: 240, align: 'left' },
    { x: 260, w: 60,  align: 'center' },
    { x: 320, w: 80,  align: 'right' },
    { x: 405, w: 100, align: 'right' },
  ];

  const safe = (v, fallback) => (v != null ? v : fallback);
  const values = [
    safe(item.nombre_prod, `Item #${safe(item.cod_prod, '?')}`),
    String(safe(item.cantidad, 0)),
    `$${Number(safe(item.precio_unit, 0)).toLocaleString('es-CO')}`,
    `$${Number(safe(item.subtotal, 0)).toLocaleString('es-CO')}`,
  ];

  const rowBg = index % 2 === 0 ? COLORS.lightBg : COLORS.white;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(rowBg);

  doc.fillColor(COLORS.dark).font('Helvetica').fontSize(9);
  cols.forEach((c, i) => {
    doc.text(values[i], c.x, y + 5, { width: c.w, align: c.align });
  });

  return y + 20;
}

function drawTotalSection(doc, y, total) {
  const totalX = 310;
  const labelX = totalX;
  const valueX = totalX + 100;
  const boxW   = 235;

  // Fondo del área de totales
  doc.roundedRect(totalX - 6, y, boxW, 50, 4).fill(COLORS.lightBg);

  // Línea separadora
  doc.moveTo(totalX, y + 25).lineTo(totalX + boxW - 12, y + 25).strokeColor(COLORS.border).lineWidth(1).stroke();

  // Subtotal
  doc.fillColor(COLORS.gray).font('Helvetica').fontSize(10);
  doc.text('Subtotal:', labelX, y + 8);
  doc.fillColor(COLORS.dark).font('Helvetica');
  doc.text(`$${Number(total).toLocaleString('es-CO')}`, valueX, y + 8, { align: 'right', width: boxW - 100 });

  // Total final
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(14);
  doc.text('TOTAL:', labelX, y + 30);
  doc.fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text(`$${Number(total).toLocaleString('es-CO')}`, valueX, y + 30, { align: 'right', width: boxW - 100 });

  return y + 60;
}

// ─── Generación del PDF ─────────────────────────────────────────────────────────

const generateInvoicePDF = (order, responseStream) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: MARGIN,
        size: 'A4',
        info: {
          Title: `Factura Kiora #${order.id_vent || ''}`,
          Author: 'Kiora Micro-Market',
          Subject: 'Comprobante de compra',
        },
      });

      let pageNumber = 1;

      doc.on('pageAdded', () => {
        pageNumber++;
        drawFooter(doc, pageNumber);
      });

      doc.pipe(responseStream);
      doc.on('end', () => resolve());
      doc.on('error', (err) => reject(err instanceof Error ? err : new Error('PDF error: ' + String(err))));

      // ── Portada ──
      drawHeader(doc);
      drawInfoBlock(doc, order);

      // ── Tabla de productos ──
      let yPos = drawTableHeader(doc, 175);

      const items = order.items || [];
      items.forEach((item, i) => {
        if (!item) return;
        // Salto de página si no caben más filas
        if (yPos > PAGE_HEIGHT - 100) {
          doc.addPage();
          // eslint-disable-next-line no-unused-vars
          pageNumber++;
          drawHeader(doc);
          yPos = drawTableHeader(doc, 100);
        }
        yPos = drawTableRow(doc, yPos, item, i);
      });

      // ── Totales ──
      yPos += 10;
      yPos = drawTotalSection(doc, yPos, order.montofinal_vent);

      // ── Footer ──
      drawFooter(doc, pageNumber);

      doc.end();
    } catch (e) {
      reject(e instanceof Error ? e : new Error('PDF generation error: ' + String(e)));
    }
  });
};

module.exports = { generateInvoicePDF };
