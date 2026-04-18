-- Migration: 002_add_indexes
-- Dominio: orders-service
-- Agregar índices en columnas de FK y filtro frecuente
-- para mejorar rendimiento de queries.

-- Up Migration
CREATE INDEX IF NOT EXISTS idx_producto_venta_fk_id_vent ON Producto_Venta(fk_id_vent);
CREATE INDEX IF NOT EXISTS idx_factura_fk_id_vent ON Factura(fk_id_vent);
CREATE INDEX IF NOT EXISTS idx_factura_id_usu ON Factura(id_usu);

-- Down Migration
-- DROP INDEX IF EXISTS idx_producto_venta_fk_id_vent;
-- DROP INDEX IF EXISTS idx_factura_fk_id_vent;
-- DROP INDEX IF EXISTS idx_factura_id_usu;
