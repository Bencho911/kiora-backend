-- Migration: 005_add_indexes
-- Dominio: inventory-service
-- Agregar índices en columnas de FK y filtro frecuente
-- para mejorar rendimiento de queries.

-- Up Migration
CREATE INDEX IF NOT EXISTS idx_inventario_cod_prod ON Inventario(cod_prod);
CREATE INDEX IF NOT EXISTS idx_inventario_fk_id_vent ON Inventario(fk_id_vent);
CREATE INDEX IF NOT EXISTS idx_suministra_cod_prod ON Suministra(cod_prod);

-- Down Migration
-- DROP INDEX IF EXISTS idx_inventario_cod_prod;
-- DROP INDEX IF EXISTS idx_inventario_fk_id_vent;
-- DROP INDEX IF EXISTS idx_suministra_cod_prod;
