'use strict';

const db = require('../config/db');

/**
 * exportRepository
 * Query denormalizado para exportación completa de ventas.
 * Usado internamente por reports-service para generar archivos Power BI.
 */

/**
 * Retorna dataset completo: Ventas + Detalle de Productos + Facturas.
 * @param {{ desde?: string, hasta?: string }} filters
 */
const findFullExport = (filters = {}) => {
    const { desde, hasta } = filters;
    return db.query(
        `SELECT 
            v.id_vent,
            v.fecha_vent,
            v.precio_prod_final,
            v.montofinal_vent,
            v.metodopago_usu,
            v.estado,
            pv.id        AS detalle_id,
            pv.cod_prod,
            pv.nom_prod,
            pv.cantidad,
            pv.precio_unit,
            (pv.cantidad * pv.precio_unit) AS subtotal_linea,
            f.id          AS factura_id,
            f.id_usu      AS factura_id_usu,
            f.cantidad_vent AS factura_cantidad,
            f.precio_prod   AS factura_precio,
            f.montototal_vent AS factura_monto_total,
            f.emitida_en    AS factura_emitida_en
         FROM Ventas v
         LEFT JOIN Producto_Venta pv ON pv.fk_id_vent = v.id_vent
         LEFT JOIN Factura f ON f.fk_id_vent = v.id_vent
         WHERE ($1::timestamp IS NULL OR v.fecha_vent >= $1)
           AND ($2::timestamp IS NULL OR v.fecha_vent <= $2)
         ORDER BY v.fecha_vent DESC, v.id_vent, pv.id`,
        [desde || null, hasta || null]
    );
};

/**
 * Retorna resumen agregado de ventas para la hoja de KPIs.
 * @param {{ desde?: string, hasta?: string }} filters
 */
const findSummary = (filters = {}) => {
    const { desde, hasta } = filters;
    return db.query(
        `SELECT 
            COUNT(DISTINCT v.id_vent) AS total_ventas,
            COALESCE(SUM(DISTINCT v.montofinal_vent), 0) AS monto_total,
            COALESCE(AVG(DISTINCT v.montofinal_vent), 0) AS ticket_promedio,
            COUNT(DISTINCT CASE WHEN v.estado = 'completada' THEN v.id_vent END) AS ventas_completadas,
            COUNT(DISTINCT CASE WHEN v.estado = 'pendiente'  THEN v.id_vent END) AS ventas_pendientes,
            COUNT(DISTINCT CASE WHEN v.estado = 'cancelada'  THEN v.id_vent END) AS ventas_canceladas,
            COALESCE(SUM(pv.cantidad), 0) AS total_productos_vendidos,
            COUNT(DISTINCT pv.cod_prod) AS productos_unicos
         FROM Ventas v
         LEFT JOIN Producto_Venta pv ON pv.fk_id_vent = v.id_vent
         WHERE ($1::timestamp IS NULL OR v.fecha_vent >= $1)
           AND ($2::timestamp IS NULL OR v.fecha_vent <= $2)`,
        [desde || null, hasta || null]
    );
};

/**
 * Ventas agrupadas por método de pago.
 */
const findByPaymentMethod = (filters = {}) => {
    const { desde, hasta } = filters;
    return db.query(
        `SELECT 
            COALESCE(metodopago_usu, 'No especificado') AS metodo_pago,
            COUNT(*) AS cantidad_ventas,
            COALESCE(SUM(montofinal_vent), 0) AS monto_total
         FROM Ventas
         WHERE ($1::timestamp IS NULL OR fecha_vent >= $1)
           AND ($2::timestamp IS NULL OR fecha_vent <= $2)
         GROUP BY metodopago_usu
         ORDER BY monto_total DESC`,
        [desde || null, hasta || null]
    );
};

/**
 * Ventas agrupadas por día.
 */
const findByDay = (filters = {}) => {
    const { desde, hasta } = filters;
    return db.query(
        `SELECT 
            DATE(fecha_vent) AS fecha,
            COUNT(*) AS cantidad_ventas,
            COALESCE(SUM(montofinal_vent), 0) AS monto_total,
            COALESCE(AVG(montofinal_vent), 0) AS ticket_promedio
         FROM Ventas
         WHERE ($1::timestamp IS NULL OR fecha_vent >= $1)
           AND ($2::timestamp IS NULL OR fecha_vent <= $2)
         GROUP BY DATE(fecha_vent)
         ORDER BY fecha DESC`,
        [desde || null, hasta || null]
    );
};

module.exports = { findFullExport, findSummary, findByPaymentMethod, findByDay };
