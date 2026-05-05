'use strict';

const ExcelJS = require('exceljs');

/**
 * excelBuilder.js
 * Genera un archivo Excel (.xlsx) profesional con múltiples hojas
 * optimizado para importación directa en Power BI.
 *
 * Usa el Workbook estándar (no streaming) para poder aplicar estilos
 * retroactivamente a cualquier celda.
 */

// ── Paleta corporativa Kiora ──────────────────────────────────────────────
const COLORS = {
    primary:    'FF1B4F72',  // Azul oscuro Kiora
    secondary:  'FF2E86C1',  // Azul medio
    accent:     'FF27AE60',  // Verde acento
    warning:    'FFE67E22',  // Naranja
    danger:     'FFE74C3C',  // Rojo
    light:      'FFEBF5FB',  // Azul claro fondo
    white:      'FFFFFFFF',
    dark:       'FF2C3E50',
    gray:       'FF95A5A6',
};

const HEADER_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.primary },
};

const HEADER_FONT = {
    bold: true,
    color: { argb: COLORS.white },
    size: 11,
    name: 'Calibri',
};

const HEADER_ALIGNMENT = { vertical: 'middle', horizontal: 'center', wrapText: true };

const BORDER_THIN = {
    top:    { style: 'thin', color: { argb: COLORS.gray } },
    left:   { style: 'thin', color: { argb: COLORS.gray } },
    bottom: { style: 'thin', color: { argb: COLORS.gray } },
    right:  { style: 'thin', color: { argb: COLORS.gray } },
};

/**
 * Aplica estilo de header a la primera fila de una hoja.
 */
const styleHeaders = (sheet) => {
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = HEADER_ALIGNMENT;
        cell.border = BORDER_THIN;
    });
    headerRow.height = 28;

    // Auto-filtro en la primera fila
    if (sheet.columnCount > 0) {
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to:   { row: 1, column: sheet.columnCount },
        };
    }
};

/**
 * Aplica bordes sutiles y zebra striping a todas las filas de datos.
 */
const styleCells = (sheet) => {
    sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // skip header
        row.eachCell((cell) => {
            cell.border = BORDER_THIN;
            cell.font = { size: 10, name: 'Calibri' };
        });
        // Zebra striping
        if (rowNum % 2 === 0) {
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: COLORS.light },
                };
            });
        }
    });
};

/**
 * Genera el workbook Excel completo y lo escribe al stream de respuesta.
 * @param {object} data — Datos del endpoint /api/orders/export/full
 * @param {WritableStream} stream — Stream de respuesta HTTP
 */
const generateSalesExcel = async (data, stream) => {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Kiora Micro-Market';
    workbook.created = new Date();

    // ═══════════════════════════════════════════════════════════════════════
    // HOJA 1: RESUMEN EJECUTIVO
    // ═══════════════════════════════════════════════════════════════════════
    const resumenSheet = workbook.addWorksheet('Resumen', {
        properties: { tabColor: { argb: COLORS.primary } },
    });

    resumenSheet.columns = [
        { header: 'Indicador', key: 'indicador', width: 38 },
        { header: 'Valor', key: 'valor', width: 30 },
    ];

    const r = data.resumen || {};
    const kpis = [
        { indicador: 'Total de Ventas', valor: Number(r.total_ventas || 0) },
        { indicador: 'Monto Total (CSD $)', valor: Number(Number(r.monto_total || 0).toFixed(2)) },
        { indicador: 'Ticket Promedio (CSD $)', valor: Number(Number(r.ticket_promedio || 0).toFixed(2)) },
        { indicador: 'Ventas Completadas', valor: Number(r.ventas_completadas || 0) },
        { indicador: 'Ventas Pendientes', valor: Number(r.ventas_pendientes || 0) },
        { indicador: 'Ventas Canceladas', valor: Number(r.ventas_canceladas || 0) },
        { indicador: 'Total Productos Vendidos (unidades)', valor: Number(r.total_productos_vendidos || 0) },
        { indicador: 'Productos Unicos Vendidos', valor: Number(r.productos_unicos || 0) },
        { indicador: '', valor: '' },
        { indicador: 'Reporte generado el', valor: new Date(data.generado_en).toLocaleString('es-CO') },
        { indicador: 'Filtro desde', valor: data.filtros?.desde || 'Sin filtro' },
        { indicador: 'Filtro hasta', valor: data.filtros?.hasta || 'Sin filtro' },
    ];

    kpis.forEach((row) => resumenSheet.addRow(row));

    // Sub-tabla: Ventas por método de pago
    resumenSheet.addRow({});
    const mpHeaderRow = resumenSheet.addRow({ indicador: 'VENTAS POR METODO DE PAGO', valor: '' });
    mpHeaderRow.getCell(1).font = { bold: true, size: 12, color: { argb: COLORS.secondary }, name: 'Calibri' };

    (data.ventas_por_metodo_pago || []).forEach((mp) => {
        resumenSheet.addRow({
            indicador: mp.metodo_pago,
            valor: `${mp.cantidad_ventas} ventas — $${Number(mp.monto_total).toFixed(2)}`,
        });
    });

    styleHeaders(resumenSheet);
    styleCells(resumenSheet);

    // ═══════════════════════════════════════════════════════════════════════
    // HOJA 2: VENTAS (tabla plana para Power BI)
    // ═══════════════════════════════════════════════════════════════════════
    const ventasSheet = workbook.addWorksheet('Ventas', {
        properties: { tabColor: { argb: COLORS.accent } },
    });

    ventasSheet.columns = [
        { header: 'ID Venta',        key: 'id_vent',         width: 12 },
        { header: 'Fecha',           key: 'fecha_vent',      width: 22 },
        { header: 'Estado',          key: 'estado',          width: 15 },
        { header: 'Metodo de Pago',  key: 'metodopago_usu',  width: 20 },
        { header: 'Monto Final ($)', key: 'montofinal_vent', width: 18, style: { numFmt: '$#,##0.00' } },
    ];

    // Deduplicar ventas del dataset denormalizado
    const ventasMap = new Map();
    (data.dataset || []).forEach((row) => {
        if (!ventasMap.has(row.id_vent)) {
            ventasMap.set(row.id_vent, {
                id_vent: row.id_vent,
                fecha_vent: row.fecha_vent ? new Date(row.fecha_vent) : null,
                estado: row.estado || 'N/A',
                metodopago_usu: row.metodopago_usu || 'No especificado',
                montofinal_vent: Number(row.montofinal_vent || 0),
            });
        }
    });

    ventasMap.forEach((venta) => {
        const addedRow = ventasSheet.addRow(venta);
        if (venta.fecha_vent) {
            addedRow.getCell('fecha_vent').numFmt = 'DD/MM/YYYY HH:mm';
        }
    });

    styleHeaders(ventasSheet);
    styleCells(ventasSheet);

    // ═══════════════════════════════════════════════════════════════════════
    // HOJA 3: DETALLE DE PRODUCTOS
    // ═══════════════════════════════════════════════════════════════════════
    const detalleSheet = workbook.addWorksheet('Detalle Productos', {
        properties: { tabColor: { argb: COLORS.warning } },
    });

    detalleSheet.columns = [
        { header: 'ID Venta',       key: 'id_vent',       width: 12 },
        { header: 'Fecha Venta',    key: 'fecha_vent',    width: 22 },
        { header: 'Codigo Producto',key: 'cod_prod',      width: 18 },
        { header: 'Nombre Producto',key: 'nom_prod',      width: 30 },
        { header: 'Cantidad',       key: 'cantidad',      width: 12 },
        { header: 'Precio Unit ($)',key: 'precio_unit',   width: 16, style: { numFmt: '$#,##0.00' } },
        { header: 'Subtotal ($)',   key: 'subtotal_linea',width: 16, style: { numFmt: '$#,##0.00' } },
        { header: 'Estado Venta',   key: 'estado',        width: 15 },
        { header: 'Metodo Pago',    key: 'metodopago_usu',width: 18 },
    ];

    (data.dataset || []).forEach((row) => {
        if (!row.detalle_id) return; // Skip ventas sin líneas de detalle
        const addedRow = detalleSheet.addRow({
            id_vent:        row.id_vent,
            fecha_vent:     row.fecha_vent ? new Date(row.fecha_vent) : null,
            cod_prod:       row.cod_prod,
            nom_prod:       row.nom_prod || `Producto #${row.cod_prod}`,
            cantidad:       Number(row.cantidad || 0),
            precio_unit:    Number(row.precio_unit || 0),
            subtotal_linea: Number(row.subtotal_linea || 0),
            estado:         row.estado || 'N/A',
            metodopago_usu: row.metodopago_usu || 'No especificado',
        });
        if (row.fecha_vent) addedRow.getCell('fecha_vent').numFmt = 'DD/MM/YYYY HH:mm';
    });

    styleHeaders(detalleSheet);
    styleCells(detalleSheet);

    // ═══════════════════════════════════════════════════════════════════════
    // HOJA 4: FACTURAS
    // ═══════════════════════════════════════════════════════════════════════
    const facturasSheet = workbook.addWorksheet('Facturas', {
        properties: { tabColor: { argb: COLORS.danger } },
    });

    facturasSheet.columns = [
        { header: 'ID Factura',       key: 'factura_id',          width: 14 },
        { header: 'ID Venta',         key: 'id_vent',             width: 12 },
        { header: 'ID Usuario',       key: 'factura_id_usu',      width: 14 },
        { header: 'Cantidad',         key: 'factura_cantidad',     width: 12 },
        { header: 'Precio Prod ($)',  key: 'factura_precio',       width: 16, style: { numFmt: '$#,##0.00' } },
        { header: 'Monto Total ($)',  key: 'factura_monto_total',  width: 18, style: { numFmt: '$#,##0.00' } },
        { header: 'Fecha Emision',    key: 'factura_emitida_en',   width: 22 },
        { header: 'Estado Venta',     key: 'estado',               width: 15 },
    ];

    // Deduplicar facturas (pueden repetirse por el LEFT JOIN con productos)
    const facturasMap = new Map();
    (data.dataset || []).forEach((row) => {
        if (row.factura_id && !facturasMap.has(row.factura_id)) {
            facturasMap.set(row.factura_id, {
                factura_id:         row.factura_id,
                id_vent:            row.id_vent,
                factura_id_usu:     row.factura_id_usu,
                factura_cantidad:   Number(row.factura_cantidad || 0),
                factura_precio:     Number(row.factura_precio || 0),
                factura_monto_total:Number(row.factura_monto_total || 0),
                factura_emitida_en: row.factura_emitida_en ? new Date(row.factura_emitida_en) : null,
                estado:             row.estado || 'N/A',
            });
        }
    });

    facturasMap.forEach((factura) => {
        const addedRow = facturasSheet.addRow(factura);
        if (factura.factura_emitida_en) addedRow.getCell('factura_emitida_en').numFmt = 'DD/MM/YYYY HH:mm';
    });

    styleHeaders(facturasSheet);
    styleCells(facturasSheet);

    // ═══════════════════════════════════════════════════════════════════════
    // HOJA 5: VENTAS POR DÍA (serie temporal para gráficas Power BI)
    // ═══════════════════════════════════════════════════════════════════════
    const diariaSheet = workbook.addWorksheet('Ventas por Dia', {
        properties: { tabColor: { argb: COLORS.secondary } },
    });

    diariaSheet.columns = [
        { header: 'Fecha',             key: 'fecha',           width: 18 },
        { header: 'Cantidad Ventas',   key: 'cantidad_ventas', width: 18 },
        { header: 'Monto Total ($)',   key: 'monto_total',     width: 18, style: { numFmt: '$#,##0.00' } },
        { header: 'Ticket Promedio ($)',key: 'ticket_promedio', width: 20, style: { numFmt: '$#,##0.00' } },
    ];

    (data.ventas_por_dia || []).forEach((row) => {
        const addedRow = diariaSheet.addRow({
            fecha:           row.fecha ? new Date(row.fecha) : null,
            cantidad_ventas: Number(row.cantidad_ventas || 0),
            monto_total:     Number(Number(row.monto_total || 0).toFixed(2)),
            ticket_promedio: Number(Number(row.ticket_promedio || 0).toFixed(2)),
        });
        if (row.fecha) addedRow.getCell('fecha').numFmt = 'DD/MM/YYYY';
    });

    styleHeaders(diariaSheet);
    styleCells(diariaSheet);

    // ── Escribir el workbook al stream de respuesta ───────────────────────
    await workbook.xlsx.write(stream);
};

module.exports = { generateSalesExcel };
